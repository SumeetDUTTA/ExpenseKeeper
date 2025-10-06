import pandas as pd
import numpy as np
import joblib
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
import io

MODEL_PATH = "expense_forecast.pkl"
model_package = joblib.load(MODEL_PATH)
model = model_package['model']
FEATURES = model_package['features']

app = FastAPI(title='Expense Forecast API', version='1.0')

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
    monthly_totals: list[dict]  # [{"month": "2025-01", "total": 8000}, ...]
    horizon: int

# -----------------------------
# Preprocessing for new data
# -----------------------------
def preprocess_new_data(df):
    df = df.copy()
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    df['Type'] = df['Type'].astype(str).str.strip().str.lower()
    df = df[df['Type'] == 'expense']

    monthly = (
        df.groupby([df['Date'].dt.to_period('M'), 'Category'])
        .agg(total_amount=('Amount', 'sum')).reset_index()
    )
    monthly['Date'] = monthly['Date'].dt.to_timestamp()

    # Lag Features
    monthly['lag_1'] = monthly.groupby('Category')['total_amount'].shift(1)
    monthly['lag_2'] = monthly.groupby('Category')['total_amount'].shift(2)
    monthly['lag_3'] = monthly.groupby('Category')['total_amount'].shift(3)

    # Rolling averages
    monthly['Rolling3'] = (
        monthly.groupby('Category')['total_amount']
        .transform(lambda x: x.shift(1).rolling(3, min_periods=1).mean())
    )
    monthly['Rolling6'] = (
        monthly.groupby('Category')['total_amount']
        .transform(lambda x: x.shift(1).rolling(6, min_periods=1).mean())
    )

    # Time features
    monthly['month_num'] = monthly['Date'].dt.month
    monthly['month_sin'] = np.sin(2*np.pi*monthly['month_num']/12)
    monthly['month_cos'] = np.cos(2*np.pi*monthly['month_num']/12)

    # One-hot encoding
    monthly = pd.get_dummies(monthly, columns=['Category'])

    # Align features
    for col in FEATURES:
        if col not in monthly.columns:
            monthly[col] = 0
    
    X_latest = monthly[FEATURES].iloc[[-1]]
    return X_latest

# -----------------------------
# Routes
# -----------------------------
@app.post("/predict")
async def forecast_timeseries(data: TimeseriesData):
    """Forecast based on timeseries data using time series techniques."""
    try:
        timeseries = data.timeseries
        horizon = data.horizon
        
        if len(timeseries) == 0:
            return {"predicted_expense": [0.0] * horizon}
        
        # Convert to numpy array for easier manipulation
        ts_array = np.array(timeseries)
        
        # More sophisticated forecasting
        if len(timeseries) >= 6:
            # Use exponential smoothing with trend
            alpha = 0.3  # smoothing parameter
            beta = 0.1   # trend parameter
            
            # Initialize
            level = ts_array[0]
            trend = (ts_array[1] - ts_array[0])
            
            # Apply exponential smoothing
            for i in range(1, len(ts_array)):
                new_level = alpha * ts_array[i] + (1 - alpha) * (level + trend)
                new_trend = beta * (new_level - level) + (1 - beta) * trend
                level, trend = new_level, new_trend
            
            # Generate forecasts
            predictions = []
            for i in range(horizon):
                forecast = level + (i + 1) * trend
                predictions.append(max(0, float(forecast)))
                
        elif len(timeseries) >= 3:
            # Use weighted moving average with trend
            weights = np.array([0.5, 0.3, 0.2])  # More weight to recent values
            recent_avg = np.average(ts_array[-3:], weights=weights)
            trend = (ts_array[-1] - ts_array[-3]) / 2
            
            predictions = []
            for i in range(horizon):
                pred = recent_avg + (trend * (i + 1))
                predictions.append(max(0, float(pred)))
        else:
            # Simple average for small datasets
            avg = np.mean(ts_array)
            predictions = [float(avg)] * horizon
        
        return {"predicted_expense": predictions}
        
    except Exception as e:
        return {"error": str(e), "predicted_expense": [0.0] * data.horizon}