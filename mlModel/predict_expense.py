import pandas as pd
import numpy as np
import joblib
import os

MODEL_PATH = "expense_forecast.pkl"

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"⚠️ Could not find {MODEL_PATH}. Train and save the model first.")

model_package = joblib.load(MODEL_PATH)
model = model_package['model']
FEATURES = model_package['features']

# -----------------------------
# Preprocessing for new data
# -----------------------------
def preprocess_new_data(df, n_months=1):
    df = df.copy()
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    df['Type'] = df['Type'].astype(str).str.strip().str.lower()
    df = df[df['Type'] == 'expense']

    monthly = (
        df.groupby([df['Date'].dt.to_period('M'), 'Category'])
        .agg(total_amount=('Amount', 'sum'))
        .reset_index()
    )
    monthly['Date'] = monthly['Date'].dt.to_timestamp()

    monthly['lag_1'] = monthly.groupby('Category')['total_amount'].shift(1)
    monthly['lag_2'] = monthly.groupby('Category')['total_amount'].shift(2)
    monthly['lag_3'] = monthly.groupby('Category')['total_amount'].shift(3)

    monthly['Rolling3'] = (
        monthly.groupby('Category')['total_amount']
        .transform(lambda x: x.shift(1).rolling(3, min_periods=1).mean())
    )
    monthly['Rolling6'] = (
        monthly.groupby('Category')['total_amount']
        .transform(lambda x: x.shift(1).rolling(6, min_periods=1).mean())
    )

    monthly['month_num'] = monthly['Date'].dt.month
    monthly['month_sin'] = np.sin(2 * np.pi * monthly['month_num'] / 12)
    monthly['month_cos'] = np.cos(2 * np.pi * monthly['month_num'] / 12)

    monthly = pd.get_dummies(monthly, columns=['Category'])

    for col in FEATURES:
        if col not in monthly.columns:
            monthly[col] = 0

    X_latest = monthly[FEATURES].iloc[[-1]]
    return X_latest

# -----------------------------
# Forecast function
# -----------------------------
def forecast_expense(df):
    X_latest = preprocess_new_data(df)
    prediction = model.predict(X_latest)[0].round()
    return {"predicted_expense": float(prediction)}

# -----------------------------
# Example run
# -----------------------------
if __name__ == "__main__":
    df = pd.read_csv("Personal_Finance_Dataset.csv")
    result = forecast_expense(df)
    print("Next month forecast:", result)
