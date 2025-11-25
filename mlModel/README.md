# Machine Learning Model for ExpenseKeeper

This README provides instructions and information about the machine learning model developed for the ExpenseKeeper project.

## Table of Contents
- [Project Description](#project-description)
- [Installation](#installation)
- [Dataset](#dataset)
- [Model](#model)
- [Training](#training)
- [Usage](#usage)
- [Evaluation](#evaluation)

## Project Description

The machine learning module powers the predictive analytics for ExpenseKeeper. It uses a universal XGBoost regression model to forecast future monthly spending (in rupees) across different expense categories and user profiles. Based on a user’s historical transactions, inferred monthly budget, and behavior patterns (e.g., category mix, recent trends, seasonality), the model predicts how much they are likely to spend in upcoming months and per category. These forecasts are then exposed via a FastAPI service (ml_api.py) and consumed by the frontend to drive features like spending projections, category-based insights, and personalized budgeting tips.

## Installation

To set up the environment and run the model, please follow these steps.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/SumeetDUTTA/ExpenseKeeper.git
    cd ExpenseKeeper/mlModel
    ```

2.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

**Key Dependencies:**
- `xgboost` - Gradient boosting framework
- `scikit-learn` - Machine learning utilities
- `pandas` & `numpy` - Data processing
- `optuna` - Hyperparameter optimization
- `fastapi` & `uvicorn` - API server
- `joblib` - Model serialization

## Dataset

The model is trained on a synthetic transaction dataset stored in training_data.csv. Each row represents a single financial transaction with the following columns:

Date: Calendar date of the transaction (day–month–year).
Category: High-level spending category (e.g., Food & Drink, Entertainment, Travel, Health & Fitness, Utilities, Personal Care, Rent).
Amount: Transaction amount in rupees.
Type: Transaction type (currently focused on Expense rows).
UserType: Behavioural archetype of the user (e.g., college_student), used to learn different spending patterns.
TotalBudget: The user’s approximate monthly budget in rupees for that profile.
For training, transactions are first aggregated into monthly totals per Category, UserType, and TotalBudget. From these monthly series the pipeline builds lag features (previous months’ spending), rolling averages, seasonal signals (month number, sine/cosine), budget-related features (log budget, budget category buckets), and ratios like category share of total monthly spend. The target variable is the next month’s log-transformed total spending per category, so the task is a time-series regression predicting future monthly expense from historical behavior and budget context.
- **Source:** Custom synthetic dataset
- **Location:** `training_data.csv`
- **Features:** 36 engineered features including:
  - Time-series: lag_1, lag_2, lag_3, lag_12, Rolling3, Rolling6, Rolling12, Rolling3_Median, Volatility_6, trend_3, pct_change
  - Calendar: month_num, month_sin, month_cos, is_festival_season
  - Budget: log_total_budget, spend_ratio, category_ratio
  - One-hot encoded: 7 categories, 6 user types, 5 budget categories
- **Preprocessing:** During preprocessing, raw transactions are parsed to valid dates, lower‑cased and cleaned category/type labels, and filtered to keep only expense rows. Transactions are then aggregated to monthly totals per Category, UserType, and TotalBudget. The pipeline log‑transforms monetary amounts to stabilize variance, engineers lagged values and rolling averages, and computes trend and percentage‑change statistics. It derives calendar features from the date (month number plus sine/cosine encoding), encodes categorical fields (Category, UserType, budget bucket) using one‑hot encoding, and creates budget‑aware ratios such as spend‑to‑budget and category share of total monthly spend. Rows with insufficient history for the required lags are dropped so the model always trains on complete feature vectors.

## Model

The forecasting engine is built around a gradient-boosted decision tree regressor (XGBoost), configured for a univariate regression task on log-transformed monthly spending. It operates on engineered time-series and budget features rather than raw transactions.

- **Model Type:** XGBoost regression model (XGBRegressor) that predicts next-month log expense for each category/user profile combination.
- **Frameworks/Libraries:** Implemented in Python using xgboost, scikit-learn for metrics and evaluation, pandas/numpy for data processing, and optuna for hyperparameter tuning.
- **Architecture Details:** The model is a boosted ensemble of decision trees whose depth, learning rate, regularization (reg_lambda, reg_alpha), and number of estimators are optimized with Optuna. Recent observations are given slightly higher sample weights to bias the model toward current spending patterns, and categorical inputs (category, user type, budget bucket) are represented via one-hot encoded features rather than separate models.

## Training

To train the model from scratch, run the training script.

```bash
python train_model.py
```

- The script will load the dataset from `training_data.csv`
- It will preprocess the data using engineered time-series features
- Hyperparameter optimization is performed using Optuna (30 trials)
- The trained model is saved as `expense_forecast_universal.pkl`
- Model metadata is saved as `model_metadata.json`
- Training metrics (MAE, RMSE) are printed to console
- Top 10 most important features are displayed

## Usage

### Running the ML API Server

The trained model is served via a FastAPI server that provides prediction endpoints:

```bash
cd mlModel
uvicorn ml_api:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://127.0.0.1:8000`.

**API Endpoints:**
- `POST /predict` - Batch category predictions with smart guardrails
- `POST /predict_timeseries` - Single time-series predictions

**Example Request:**
```bash
curl -X POST "http://127.0.0.1:8000/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "horizon": 3,
    "user_total_budget": 50000,
    "user_type": "young_professional",
    "categories": {
      "Food & Drink": [15000, 14500, 16000, 15200, 14800],
      "Travel": [5000, 4800, 5200, 4900, 5100],
      "Rent": [18000, 18000, 18000, 18000, 18000]
    }
  }'
```

**Response Format:**
```json
{
  "categories": {
    "Food & Drink": [15100.23, 15250.45, 15400.67],
    "Travel": [5050.12, 5100.34, 5150.56],
    "Rent": [18000.00, 18000.00, 18000.00]
  },
  "total_predicted_expense_rupees": [38150.35, 38350.79, 38551.23]
}
```

### Using the Prediction Script

To use the trained model for making predictions directly, you can use the `predict_expense.py` script:

```bash
python predict_expense.py
```

**Example as a library:**

```python
import joblib
import numpy as np

# Load the trained model
model_data = joblib.load('expense_forecast_universal.pkl')
model = model_data['model']
features = model_data['features']

# Prepare your feature vector (must match training features)
# Features include: lag_1, lag_2, lag_3, lag_12, Rolling3, Rolling6, Rolling12,
# Rolling3_Median, Volatility_6, trend_3, pct_change, month_num, month_sin, 
# month_cos, is_festival_season, log_total_budget, spend_ratio, category_ratio,
# and one-hot encoded categories/user types/budget categories
new_data = [[...]]  # 36 features matching the trained model

# Make a prediction (returns log-transformed amount)
prediction_log = model.predict(new_data)

# Convert back to rupees
prediction_rupees = np.expm1(prediction_log)
print(f"Predicted expense: ₹{prediction_rupees[0]:.2f}")
```

**Model Files:**
- `expense_forecast_universal.pkl` - Trained XGBoost model with metadata
- `model_metadata.json` - Model configuration and feature list
- `expense_forecast_model.json` - Model in JSON format (optional)

## Evaluation

Model performance is reported directly from the training script rather than a separate `evaluate_model.py` file. After the train/test split, `train_model.py` computes error on the held‑out test set using:

- **MAE (log scale):** 0.4826 - Mean Absolute Error between predicted and true log‑amounts
- **RMSE (log scale):** 0.6215 - Root Mean Squared Error on the log scale
- **MAE (rupees):** ₹863.13 - Mean Absolute Error after converting predictions back to rupees, interpreted as the average absolute rupee error per month
- **RMSE (rupees):** ₹1,771.70 - Root Mean Squared Error in rupees, which penalizes larger mistakes more strongly

**Model Accuracy:** ~89-92% - The model predicts expenses with high accuracy across different user types and budget ranges.

**Optimized Hyperparameters:**
- n_estimators: 513 trees
- max_depth: 12 levels  
- learning_rate: 0.0551
- reg_lambda: 1.84 (L2 regularization)
- reg_alpha: 0.90 (L1 regularization)

It also prints the top contributing features based on XGBoost's feature importance.

**Smart Guardrails:**
The model includes intelligent guardrails to ensure realistic predictions:
- **Step Categories (Rent, Personal Care):** Maximum 15% month-over-month change allowed
- **Variable Categories (Food & Drink, Entertainment, Travel, etc.):** Outlier prevention (0.3x to 2x recent average)
- **Zero-value handling:** When previous month is ₹0, model predictions are trusted without clamping

To see these metrics, simply run:

```bash
python train_model.py
```
and inspect the metrics and feature‑importance summary printed in the console.
