import pandas as pd
import numpy as np
import joblib
from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime
import uvicorn
import io

MODEL_PATH = "expense_forecast_universal.pkl"  # Use the new universal model
model_package = joblib.load(MODEL_PATH)
model = model_package['model']
FEATURES = model_package['features']

app = FastAPI(title='Expense Forecast API', version='2.0')

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
    lag_1 = ts[-1]
    lag_2 = ts[-2] if len(ts) > 1 else ts[-1]
    lag_3 = ts[-3] if len(ts) > 2 else ts[-1]
    lag_12 = ts[-12] if len(ts) > 11 else ts[-1]

    Rolling3 = np.mean(ts[-3:])
    Rolling6 = np.mean(ts[-6:]) if len(ts) >= 6 else Rolling3
    Rolling12 = np.mean(ts[-12:]) if len(ts) >= 12 else Rolling6

    trend_3 = ts[-1] - ts[-3] if len(ts) > 3 else 0
    pct_change = (ts[-1] - ts[-2]) / (abs(ts[-2]) + 1e-9) if len(ts) > 1 else 0

    month_total = np.sum(ts[-3:])
    category_ratio = ts[-1] / (month_total + 1e-9)

    month_sin = np.sin(2 * np.pi * month_index / 12)
    month_cos = np.cos(2 * np.pi * month_index / 12)

    X = np.array([[lag_1, lag_2, lag_3, lag_12,
                   Rolling3, Rolling6, Rolling12,
                   trend_3, pct_change, month_total,
                   category_ratio, month_index, month_sin, month_cos]])
    return X

#------------------------------------------------------------
# Helper: Forecast single series (in rupees)
# ------------------------------------------------------------
def forecast_series(ts: list[float], horizon: int, user_total_budget: float = 0.0, user_type: str = "college_student"):
    # Handle edge cases
    if not ts or horizon <= 0:
        return [0.0] * horizon
        
    ts = np.array(ts, dtype=float)
    preds = []
    
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
        X_df = pd.DataFrame(features, columns=[
            'lag_1', 'lag_2', 'lag_3', 'lag_12',
            'Rolling3', 'Rolling6', 'Rolling12',
            'trend_3', 'pct_change',
            'month_total', 'category_ratio',
            'month_num', 'month_sin', 'month_cos'
        ])

        X_df['log_total_budget'] = np.log1p(user_total_budget)

        def budget_cat(val):
            if val <= 5000:
                return 'low'
            elif val <= 10000:
                return 'moderate'
            elif val <= 20000:
                return 'high'
            elif val <= 40000:
                return 'very_high'
            else:
                return 'luxury'
        bc = budget_cat(user_total_budget)
        for cat in ['low', 'moderate', 'high', 'very_high', 'luxurt']:
            X_df[f'budget_category_{cat}'] = 1 if cat == bc else 0

        user_types = ['college_student', 'young_professional', 'family_moderate', 'family_high', 'luxury_lifestyle', 'senior_retired']

        for ut in user_types:
            X_df[f'UserType_{ut}'] = 1 if ut == user_type else 0
        
        last_amount = ts[-1] if len(ts) > 0 else 0.0
        X_df['spend_ratio'] = (np.log1p(last_amount) / (np.log1p(user_total_budget) + 1e-9))

        for col in FEATURES:
            if col not in X_df.columns:
                X_df[col] = 0
        X_df = X_df[FEATURES]

        pred_log = model.predict(X_df)[0]
        pred = float(np.expm1(pred_log))
        
        # Light stability check - only prevent extreme outliers
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
        preds = forecast_series(data.timeseries, data.horizon)
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
                series, data.horizon,
                user_total_budget=data.user_total_budget,
                user_type=data.user_type
            )
            results[category] = preds
            total += np.array(preds)
        
        return {
            "categories": results,
            "total_predicted_expense_rupees": total.round(2).tolist()
        }
    except Exception as e:
        return {
            "error": str(e),
            "categories": {},
            "total_predicted_expense_rupees": [0.0] * data.horizon
        }

    
def api():
    uvicorn.run("ml_api:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    api()

