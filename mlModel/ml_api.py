import pandas as pd
import numpy as np
import joblib
import json
import os
from xgboost import XGBRegressor
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import uvicorn
import io
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info("Starting ML API...")
logger.info("numpy version: %s", np.__version__)

# Load model - try JSON first, fallback to pickle
MODEL_JSON_PATH = "expense_forecast_model.json"
METADATA_PATH = "model_metadata.json"
MODEL_PKL_PATH = "expense_forecast_universal.pkl"

if os.path.exists(MODEL_JSON_PATH) and os.path.exists(METADATA_PATH):
	logger.info("Loading model from JSON format...")
	model = XGBRegressor()
	model.load_model(MODEL_JSON_PATH)

	with open(METADATA_PATH, "r") as f:
		metadata = json.load(f)
	FEATURES = metadata["features"]
	logger.info("✅ Model loaded from JSON successfully! Features: %d", len(FEATURES))
else:
	logger.info("JSON files not found, loading from pickle: %s", MODEL_PKL_PATH)
	model_package = joblib.load(MODEL_PKL_PATH)
	logger.info("Loaded object type: %s", type(model_package))

	if isinstance(model_package, dict):
		model = model_package["model"]
		FEATURES = model_package["features"]
		logger.info("Loaded package dict. Features found: %s", bool(FEATURES))
	else:
		model = model_package
		FEATURES = None
		logger.warning("Model package is not a dict. FEATURES set to None.")

app = FastAPI(title="Expense Forecast API", version="2.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins like ["https://expense-keeper-two.vercel.app", "http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Request body models
# -------------------------


class ExpenseData(BaseModel):
	Date: str
	Amount: float
	Category: str
	Type: str


class TimeseriesData(BaseModel):
	timeseries: list[float]
	horizon: int


class MonthlyExpenseData(BaseModel):
	monthly_totals: list[dict]
	horizon: int


class CategoryBatchData(BaseModel):
	categories: dict[str, list[float]]
	horizon: int
	user_total_budget: float = 0.0
	user_type: str = "college_student"


# -----------------------------
# Feature generator
# -----------------------------


def create_features(ts: np.ndarray, month_index: int):
	"""Generate lag, rolling, trend, and time features for next prediction."""
	# Convert to log space to match training
	ts_log = np.log1p(ts)

	lag_1 = ts_log[-1]
	lag_2 = ts_log[-2] if len(ts_log) > 1 else ts_log[-1]
	lag_3 = ts_log[-3] if len(ts_log) > 2 else ts_log[-1]
	lag_12 = ts_log[-12] if len(ts_log) > 11 else ts_log[-1]

	Rolling3 = np.mean(ts_log[-3:])
	Rolling6 = np.mean(ts_log[-6:]) if len(ts_log) >= 6 else Rolling3
	Rolling12 = np.mean(ts_log[-12:]) if len(ts_log) >= 12 else Rolling6

	Rolling3_Median = np.median(ts_log[-3:])
	Volatility_6 = np.std(ts_log[-6:]) if len(ts_log) >= 6 else 0

	trend_3 = ts_log[-1] - ts_log[-4] if len(ts_log) > 3 else 0
	pct_change = (ts_log[-1] - ts_log[-2]) / \
	              (abs(ts_log[-2]) + 1e-9) if len(ts_log) > 1 else 0

	month_total = np.sum(ts_log[-3:])
	category_ratio = ts_log[-1] / (month_total + 1e-9)

	month_sin = np.sin(2 * np.pi * month_index / 12)
	month_cos = np.cos(2 * np.pi * month_index / 12)

	X = np.array(
		[
			[
				lag_1,
				lag_2,
				lag_3,
				lag_12,
				Rolling3,
				Rolling6,
				Rolling12,
				Rolling3_Median,
				Volatility_6,
				trend_3,
				pct_change,
				month_total,
				category_ratio,
				month_index,
				month_sin,
				month_cos,
			]
		]
	)
	return X


# ------------------------------------------------------------
# Helper: Forecast single series (in rupees) with guardrails
# ------------------------------------------------------------


def forecast_series(
	ts: list[float],
	horizon: int,
	user_total_budget: float = 0.0,
	user_type: str = "college_student",
	category: str = "",
):
	# Handle edge cases
	if not ts or horizon <= 0:
		return [0.0] * horizon

	ts = np.array(ts, dtype=float)
	preds = []

	# Define step categories and max change percentage
	STEP_CATEGORIES = ["Rent", "Personal Care"]
	MAX_CHANGE_PCT = 0.15  # 15% max monthly change for step categories

	original_ts = ts.copy()
	ts_extended = list(ts)
	current_month = datetime.now().month

	for i in range(horizon):
		# For the first prediction, use the original series
		if i == 0:
			feature_ts = np.array(ts_extended)
		else:
			# Later predictions: use historical data + moderately adjusted predictions
			hist_weight = 0.85
			pred_weight = 0.15

			# Use historical trend to adjust predictions
			if len(original_ts) >= 3:
				recent_trend = np.mean(original_ts[-3:])
				# Adjust previous predictions toward historical trend
				adjusted_preds = []
				for j, pred in enumerate(preds):
					adjustment = hist_weight * recent_trend + pred_weight * pred
					adjusted_preds.append(adjustment)
				feature_ts = np.concatenate([original_ts, adjusted_preds])
			else:
				feature_ts = np.array(ts_extended)

		features = create_features(feature_ts, (current_month + i - 1) % 12 + 1)
		X_df = pd.DataFrame(
			features,
			columns=[
				"lag_1",
				"lag_2",
				"lag_3",
				"lag_12",
				"Rolling3",
				"Rolling6",
				"Rolling12",
				"Rolling3_Median",
				"Volatility_6",
				"trend_3",
				"pct_change",
				"month_total",
				"category_ratio",
				"month_num",
				"month_sin",
				"month_cos",
			],
		)

		X_df["log_total_budget"] = np.log1p(user_total_budget)

		# Add is_festival_season feature (October-December)
		pred_month = (current_month + i - 1) % 12 + 1
		X_df["is_festival_season"] = 1 if pred_month in [10, 11, 12] else 0

		def budget_cat(val):
			if val <= 5000:
				return "low"
			elif val <= 10000:
				return "moderate"
			elif val <= 20000:
				return "high"
			elif val <= 40000:
				return "very_high"
			else:
				return "luxury"

		bc = budget_cat(user_total_budget)
		for cat in ["low", "moderate", "high", "very_high", "luxury"]:
			X_df[f"budget_category_{cat}"] = 1 if cat == bc else 0

		user_types = [
			"college_student",
			"young_professional",
			"family_moderate",
			"family_high",
			"luxury_lifestyle",
			"senior_retired",
		]

		for ut in user_types:
			X_df[f"UserType_{ut}"] = 1 if ut == user_type else 0

		# Use log-transformed amount for spend_ratio
		last_amount_log = np.log1p(ts[-1]) if len(ts) > 0 else 0.0
		X_df["spend_ratio"] = last_amount_log / (X_df["log_total_budget"] + 1e-9)

		for col in FEATURES:
			if col not in X_df.columns:
				X_df[col] = 0
		X_df = X_df[FEATURES]

		pred_log = model.predict(X_df)[0]
		pred = float(np.expm1(pred_log))

		# Apply smart guardrails for step categories
		recent_actual = ts[-1] if len(ts) > 0 else pred

		if category in STEP_CATEGORIES:
			if recent_actual > 0:
				lower_bound = recent_actual * (1 - MAX_CHANGE_PCT)
				upper_bound = recent_actual * (1 + MAX_CHANGE_PCT)

				if pred < lower_bound or pred > upper_bound:
					pred = np.clip(pred, lower_bound, upper_bound)
		else:
			# Light stability check for variable categories - only prevent extreme outliers
			if len(original_ts) >= 3:
				recent_avg = np.mean(original_ts[-3:])
				pred = max(recent_avg * 0.3, min(recent_avg * 2.0, pred))

		# Introduce slight random variation for months 2 and 3 to avoid identical predictions
		if i > 0:
			import random

			random.seed(42 + i)
			variation_factor = 1 + random.uniform(-0.03, 0.03)
			pred *= variation_factor

		pred = max(0.0, pred)
		ts_extended.append(pred)
		preds.append(round(pred, 2))

	return preds


# -----------------------------
# Prediction route
# -----------------------------


@app.post("/predict_timeseries")
async def forecast_timeseries(data: TimeseriesData):
	try:
		preds = forecast_series(data.timeseries, data.horizon, category="")
		return {"predicted_expense_rupees": preds}
	except Exception as e:
		return {"error": str(e), "predicted_expense_rupees": [0.0] * data.horizon}


# -----------------------------
# Batch category forecast route
# -----------------------------


@app.post("/predict")
async def forecast_batch(data: CategoryBatchData):
	try:
		results = {}
		total = np.zeros(data.horizon)
		for category, series in data.categories.items():
			preds = forecast_series(
				series,
				data.horizon,
				user_total_budget=data.user_total_budget,
				user_type=data.user_type,
				category=category,
			)
			results[category] = preds
			total += np.array(preds)

		return {
			"categories": results,
			"total_predicted_expense_rupees": total.round(2).tolist(),
		}
	except Exception as e:
		return {
			"error": str(e),
			"categories": {},
			"total_predicted_expense_rupees": [0.0] * data.horizon,
		}


def api():
	uvicorn.run("ml_api:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
	api()
