# Machine Learning Model for [Project Name]

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

2.  **Create a virtual environment (recommended):**
  ```bash
  python -m venv venv
  source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
  ```

3.  **Install dependencies:**
  Make sure you have a `requirements.txt` file in your project root.
  ```bash
  pip install -r requirements.txt
  ```

## Dataset

The model is trained on a synthetic transaction dataset stored in training_data.csv. Each row represents a single financial transaction with the following columns:

Date: Calendar date of the transaction (day–month–year).
Category: High-level spending category (e.g., Food & Drink, Entertainment, Travel, Health & Fitness, Utilities, Personal Care, Rent).
Amount: Transaction amount in rupees.
Type: Transaction type (currently focused on Expense rows).
UserType: Behavioural archetype of the user (e.g., college_student), used to learn different spending patterns.
TotalBudget: The user’s approximate monthly budget in rupees for that profile.
For training, transactions are first aggregated into monthly totals per Category, UserType, and TotalBudget. From these monthly series the pipeline builds lag features (previous months’ spending), rolling averages, seasonal signals (month number, sine/cosine), budget-related features (log budget, budget category buckets), and ratios like category share of total monthly spend. The target variable is the next month’s log-transformed total spending per category, so the task is a time-series regression predicting future monthly expense from historical behavior and budget context.
- **Source:** It's a custom dataset.
- **Description:** The feature set is built from monthly, per‑category aggregates and includes time‑series signals (lags over 1, 2, 3, and 12 months; rolling 3/6/12‑month averages; 3‑month trend; percent change), calendar features (month number plus sine/cosine seasonality), budget context (log of the user’s total monthly budget, bucketed budget category, spend‑to‑budget ratio), and behavior mix (category one‑hot encodings, user type one‑hot encodings, and each category’s share of the user’s monthly total). The target variable is the next month’s log‑transformed total spend for each category and user type, so the model learns to regress from historical behavior and budget context to future monthly expense in rupees.
- **Preprocessing:** During preprocessing, raw transactions are parsed to valid dates, lower‑cased and cleaned category/type labels, and filtered to keep only expense rows. Transactions are then aggregated to monthly totals per Category, UserType, and TotalBudget. The pipeline log‑transforms monetary amounts to stabilize variance, engineers lagged values and rolling averages, and computes trend and percentage‑change statistics. It derives calendar features from the date (month number plus sine/cosine encoding), encodes categorical fields (Category, UserType, budget bucket) using one‑hot encoding, and creates budget‑aware ratios such as spend‑to‑budget and category share of total monthly spend. Rows with insufficient history for the required lags are dropped so the model always trains on complete feature vectors.

mlModel\training_data.csv

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

- The script will load the dataset from the `mlModel\training_data.csv` directory.
- It will preprocess the data, train the model, and save the trained model artifact (e.g., `model.pkl`, `model.h5`).

## Usage

To use the trained model for making predictions, you can use the `mlModel/predict_expense.py` script or import the necessary functions into your own code.

**Example using `mlModel/predict_expense.py`:**

```bash
python mlModel/predict_expense.py --input "[input_data_for_prediction]"
```

**Example as a library:**

```python
import joblib # or tensorflow.keras.models.load_model

# Load the trained model
model = joblib.load('mlModel/expense_forecast_universal.pkl')

# Prepare your new data (ensure it's in the same format as the training data)
new_data = [[...]] # Example: [[5.1, 3.5, 1.4, 0.2]]

# Make a prediction
prediction = model.predict(new_data)
print(f"Prediction: {prediction}")
```

## Evaluation

Model performance is reported directly from the training script rather than a separate `evaluate_model.py` file. After the train/test split, `train_model.py` computes error on the held‑out test set using:

- **MAE (log scale):** Mean Absolute Error between predicted and true log‑amounts.
- **RMSE (log scale):** Root Mean Squared Error on the log scale.
- **MAE (rupees):** Mean Absolute Error after converting predictions back to rupees (`expm1`), interpreted as the average absolute rupee error per month.
- **RMSE (rupees):** Root Mean Squared Error in rupees, which penalizes larger mistakes more strongly.

It also prints the top contributing features based on XGBoost’s feature importance.  
To see these metrics, simply run:

```bash
python train_model.py
```
and inspect the metrics and feature‑importance summary printed in the console.
