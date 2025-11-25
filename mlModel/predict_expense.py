import pandas as pd
import numpy as np
import joblib
import json
import os
from xgboost import XGBRegressor

# Load model - try JSON first, fallback to pickle
MODEL_JSON_PATH = "expense_forecast_model.json"
METADATA_PATH = "model_metadata.json"
MODEL_PKL_PATH = "expense_forecast_universal.pkl"

if os.path.exists(MODEL_JSON_PATH) and os.path.exists(METADATA_PATH):
	print("Loading model from JSON format...")
	model = XGBRegressor()
	model.load_model(MODEL_JSON_PATH)

	with open(METADATA_PATH, "r") as f:
		metadata = json.load(f)
	FEATURES = metadata["features"]
	print(f"✅ Model loaded from JSON successfully! Features: {len(FEATURES)}")
else:
	print(f"JSON files not found, loading from pickle: {MODEL_PKL_PATH}")
	if not os.path.exists(MODEL_PKL_PATH):
		raise FileNotFoundError(
			f"Could not find {MODEL_PKL_PATH}. Train and save the model first."
		)

	model_package = joblib.load(MODEL_PKL_PATH)
	model = model_package["model"]
	FEATURES = model_package["features"]
	print(f"✅ Model loaded from pickle successfully! Features: {len(FEATURES)}")


def detect_user_type_and_budget(df):
	df_exp = df[df["Type"].str.lower() == "expense"].copy()

	if len(df_exp) == 0:
		return "young_professional", 8000

	df_exp["Date"] = pd.to_datetime(df_exp["Date"])
	monthly_totals = (
		df_exp.groupby(df_exp["Date"].dt.to_period("M"))["Amount"].sum().reset_index()
	)

	avg_monthly_spending = monthly_totals["Amount"].mean()

	category_breakdown = df_exp.groupby("Category")["Amount"].sum()
	total_spending = category_breakdown.sum()

	if total_spending == 0:
		return "young_professional", 8000

	food_pct = category_breakdown.get("Food and Drink", 0) / total_spending
	rent_pct = category_breakdown.get("Rent", 0) / total_spending

	if avg_monthly_spending < 5000:
		if food_pct > 0.35:
			return "college_student", min(avg_monthly_spending, 3000)
		else:
			return "young_professional", min(avg_monthly_spending, 8000)
	elif avg_monthly_spending < 12000:
		return "young_professional", avg_monthly_spending
	elif avg_monthly_spending < 25000:
		if rent_pct < 0.1:
			return "senior_retired", avg_monthly_spending
		else:
			return "family_moderate", avg_monthly_spending
	elif avg_monthly_spending < 45000:
		return "family_high", avg_monthly_spending
	else:
		return "luxury_lifestyle", avg_monthly_spending


def create_universal_features(monthly_data, user_type, total_budget):
	df = monthly_data.copy()

	df["UserType"] = user_type
	df["TotalBudget"] = total_budget
	df["log_total_budget"] = np.log1p(total_budget)

	if total_budget <= 5000:
		budget_cat = "low"
	elif total_budget <= 10000:
		budget_cat = "moderate"
	elif total_budget <= 20000:
		budget_cat = "high"
	elif total_budget <= 40000:
		budget_cat = "very_high"
	else:
		budget_cat = "luxury"

	df["budget_category"] = budget_cat
	df["log_amount"] = np.log1p(df["total_amount"])
	df["month_num"] = df["Date"].dt.month
	df["month_sin"] = np.sin(2 * np.pi * df["month_num"] / 12)
	df["month_cos"] = np.cos(2 * np.pi * df["month_num"] / 12)
	df["is_festival_season"] = df["Date"].dt.month.isin([10, 11, 12]).astype(int)
	df["spend_ratio"] = df["log_amount"] / df["log_total_budget"]

	df["lag_1"] = df.groupby(["Category", "UserType"])["log_amount"].shift(1)
	df["lag_2"] = df.groupby(["Category", "UserType"])["log_amount"].shift(2)
	df["lag_3"] = df.groupby(["Category", "UserType"])["log_amount"].shift(3)
	df["lag_12"] = df.groupby(["Category", "UserType"])["log_amount"].shift(12)

	df["Rolling3"] = df.groupby(["Category", "UserType"])["log_amount"].transform(
		lambda x: x.shift(1).rolling(3, min_periods=1).mean()
	)
	df["Rolling6"] = df.groupby(["Category", "UserType"])["log_amount"].transform(
		lambda x: x.shift(1).rolling(6, min_periods=1).mean()
	)
	df["Rolling12"] = df.groupby(["Category", "UserType"])["log_amount"].transform(
		lambda x: x.shift(1).rolling(12, min_periods=1).mean()
	)

	df["Rolling3_Median"] = df.groupby(["Category", "UserType"])[
		"log_amount"
	].transform(lambda x: x.shift(1).rolling(3, min_periods=1).median())
	df["Volatility_6"] = df.groupby(["Category", "UserType"])["log_amount"].transform(
		lambda x: x.shift(1).rolling(6, min_periods=1).std()
	)

	df["trend_3"] = df.groupby(["Category", "UserType"])["log_amount"].transform(
		lambda x: x.diff(3)
	)
	df["pct_change"] = (
		df.groupby(["Category", "UserType"])["log_amount"].pct_change().fillna(0)
	)

	df["month_total"] = df.groupby(["Date", "UserType"])["log_amount"].transform("sum")
	df["category_ratio"] = df["log_amount"] / df["month_total"]

	# IMPORTANT: Drop rows with NaN to match training data processing
	# This ensures distribution consistency with the trained model
	print(f"Rows before dropna: {len(df)}")
	df = df.dropna()
	print(f"Rows after dropna: {len(df)}")

	if len(df) == 0:
		raise ValueError(
			"No complete feature vectors after dropna - need more historical data"
		)

	df = pd.get_dummies(
		df, columns=["Category", "UserType", "budget_category"], drop_first=False
	)

	# Debug: Check which categorical features are present
	cat_features = [
		col
		for col in df.columns
		if col.startswith(("Category_", "UserType_", "budget_category_"))
	]
	# Show first 5
	print(f"Created categorical features: {cat_features[:5]}...")

	for col in FEATURES:
		if col not in df.columns:
			df[col] = 0

	return df[FEATURES]


def forecast_expense(df):
	user_type, total_budget = detect_user_type_and_budget(df)
	print(f"Detected user profile: {user_type} with budget Rs{total_budget:,.0f}/month")

	df = df.copy()
	df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
	df["Type"] = df["Type"].astype(str).str.strip().str.lower()
	df_exp = df[df["Type"] == "expense"]

	if len(df_exp) == 0:
		return {"predicted_expense": int(total_budget * 0.8)}

	monthly = (
		df_exp.groupby([df_exp["Date"].dt.to_period("M"), "Category"])
		.agg(total_amount=("Amount", "sum"))
		.reset_index()
	)
	monthly["Date"] = monthly["Date"].dt.to_timestamp()

	if len(monthly) == 0:
		return {"predicted_expense": int(total_budget * 0.8)}

	monthly = monthly.sort_values(["Category", "Date"])

	# Debug: Show what we're working with
	print(f"Monthly data shape: {monthly.shape}")
	print(f"Date range: {monthly['Date'].min()} to {monthly['Date'].max()}")
	print(
		f"Sample monthly totals:\n{monthly.groupby('Category')['total_amount'].tail(1)}"
	)

	try:
		feature_data = create_universal_features(monthly, user_type, total_budget)

		if len(feature_data) == 0:
			raise ValueError("No feature data available")

		print(f"Feature data shape: {feature_data.shape}")

		# Load step categories from model metadata
		STEP_CATEGORIES = ["Rent", "Personal Care"]
		MAX_CHANGE_PCT = 0.15  # Max allowed monthly change (15%)

		# Get the latest data point for each unique category
		category_cols = [
			col for col in feature_data.columns if col.startswith("Category_")
		]

		# For each category present, get the last row
		predictions_by_cat = []
		print(
			"\n🛡️ Applying Smart Guardrails (Max Monthly Change: 15% for step categories)"
		)

		for cat_col in category_cols:
			cat_data = feature_data[feature_data[cat_col] == 1]
			if len(cat_data) > 0:
				# Keep as DataFrame with proper dtypes
				X_latest = cat_data.iloc[[-1]]

				# Debug: Check lag values
				lag1_val = X_latest["lag_1"].values[0]
				# Last month's actual spending
				recent_actual = np.expm1(lag1_val)

				log_pred = model.predict(X_latest)[0]
				pred_rupees = np.expm1(log_pred)
				cat_name = cat_col.replace("Category_", "")

				# Apply guardrails for step categories
				if cat_name in STEP_CATEGORIES:

					if recent_actual == 0:
						print(
							f"   ☑️ {cat_name}: Previous month was ₹0. Trusting model prediction (₹{pred_rupees:.0f})."
						)
						continue

					lower_bound = recent_actual * (1 - MAX_CHANGE_PCT)
					upper_bound = recent_actual * (1 + MAX_CHANGE_PCT)

					if pred_rupees < lower_bound or pred_rupees > upper_bound:
						clamped_val = np.clip(pred_rupees, lower_bound, upper_bound)
						pred_rupees = clamped_val
						print(
							f"   ⚠️ {cat_name}: ₹{pred_rupees:.0f} → ₹{clamped_val:.0f} (clamped, prev: ₹{recent_actual:.0f})"
						)
					else:
						print(
							f"   ✅ {cat_name}: ₹{pred_rupees:.0f} (within limits, prev: ₹{recent_actual:.0f})"
						)
				else:
					print(
						f"   ⚙️ {cat_name}: ₹{pred_rupees:.0f} (variable category, prev: ₹{recent_actual:.0f})"
					)

				predictions_by_cat.append((cat_name, int(pred_rupees)))

		total_predicted = sum(p[1] for p in predictions_by_cat)
		category_predictions = dict(predictions_by_cat)

		print(f"\nCategory predictions: {category_predictions}")
		print(f"Total predicted: ₹{int(total_predicted)}")

		return {
			"predicted_expense": int(round(total_predicted)),
			"category_breakdown": category_predictions,
		}

	except Exception as e:
		print(f"ML prediction failed: {e}. Using statistical fallback.")
		recent_avg = monthly.groupby("Category")["total_amount"].tail(3).mean().sum()

		if pd.isna(recent_avg) or recent_avg == 0:
			predicted_expense = int(total_budget * 0.8)
		else:
			predicted_expense = int(recent_avg * 1.05)

		return {"predicted_expense": predicted_expense}


if __name__ == "__main__":
	# Sample data using the same categories as the training data
	# Need at least 13 months for lag_12 feature
	sample_data = pd.DataFrame(
		{
			# 14 months of data
			"Date": pd.date_range("2023-03-01", periods=420, freq="D"),
			"Category": np.random.choice(
				[
					"Food & Drink",
					"Travel",
					"Entertainment",
					"Utilities",
					"Health & Fitness",
					"Rent",
				],
				420,
			),
			"Amount": np.random.randint(500, 3000, 420),
			"Type": "expense",
		}
	)

	result = forecast_expense(sample_data)
	print("Next month forecast:", result)
