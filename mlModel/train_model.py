import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor
import optuna
import joblib

df = pd.read_csv("training_data.csv")

def train_universal_model():
    # Train XGBoost model on universal data covering all user types
    
    # Preprocess exactly like before but with new features
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    df['Year'] = df['Date'].dt.year
    df['Month'] = df['Date'].dt.month
    df['Quarter'] = df['Date'].dt.quarter
    df['DayOfWeek'] = df['Date'].dt.dayofweek
    df['Type'] = df['Type'].astype(str).str.strip().str.lower()

    df_exp = df[df['Type'] == 'expense'].copy()

    # Monthly expense totals per category AND user type
    monthly = (
        df_exp.groupby([df_exp['Date'].dt.to_period('M'), 'Category', 'UserType', 'TotalBudget'])
        .agg(total_amount=('Amount', 'sum'))
        .reset_index()
    )

    monthly['Date'] = monthly['Date'].dt.to_timestamp()

    # Log-scaling
    monthly['log_amount'] = np.log1p(monthly['total_amount'])

    # Lag features
    for lag in [1, 2, 3, 12]:
        monthly[f'lag_{lag}'] = monthly.groupby(['Category', 'UserType'])['log_amount'].shift(lag)

    # Rolling averages
    monthly['Rolling3'] = (
        monthly.groupby(['Category', 'UserType'])['log_amount']
        .transform(lambda x: x.shift(1).rolling(3, min_periods=1).mean())
    )
    monthly['Rolling6'] = (
        monthly.groupby(['Category', 'UserType'])['log_amount']
        .transform(lambda x: x.shift(1).rolling(6, min_periods=1).mean())
    )
    monthly['Rolling12'] = (
        monthly.groupby(['Category', 'UserType'])['log_amount']
        .transform(lambda x: x.shift(1).rolling(12, min_periods=1).mean())
    )

    # 1. Rolling Median (Robust to outliers)
    monthly['Rolling3_Median'] = (
        monthly.groupby(['Category', 'UserType'])['log_amount']
        .transform(lambda x: x.shift(1).rolling(3, min_periods=1).median())
    )

    # 2. Volatility (Standard Deviation of the last 6 months)
    # This tells the model: "Is this user usually stable or erratic?"
    monthly['Volatility_6'] = (
        monthly.groupby(['Category', 'UserType'])['log_amount']
        .transform(lambda x: x.shift(1).rolling(6, min_periods=1).std())
    )

    # Time-based features
    monthly['month_num'] = monthly['Date'].dt.month
    monthly['month_sin'] = np.sin(2 * np.pi * monthly['month_num'] / 12)
    monthly['month_cos'] = np.cos(2 * np.pi * monthly['month_num'] / 12)

    # NEW UNIVERSAL FEATURES
    # Budget level features (key for universal model!)
    monthly['log_total_budget'] = np.log1p(monthly['TotalBudget'])
    monthly['budget_category'] = pd.cut(monthly['TotalBudget'], 
                                       bins=[0, 5000, 10000, 20000, 40000, 100000],
                                       labels=['low', 'moderate', 'high', 'very_high', 'luxury'])
    
    # Income-relative spending
    monthly['spend_ratio'] = monthly['log_amount'] / monthly['log_total_budget']
    
    # Spending trend and momentum
    monthly['trend_3'] = monthly.groupby(['Category', 'UserType'])['log_amount'].transform(lambda x: x.diff(3))
    monthly['pct_change'] = monthly.groupby(['Category', 'UserType'])['log_amount'].pct_change().fillna(0)

    # Category ratios
    monthly['month_total'] = monthly.groupby(['Date', 'UserType'])['log_amount'].transform('sum')
    monthly['category_ratio'] = monthly['log_amount'] / monthly['month_total']

    # Target
    monthly['target'] = monthly.groupby(['Category', 'UserType'])['log_amount'].shift(-1)

    # Clean dataset
    data = monthly.dropna().reset_index(drop=True)

    # One-hot encode categories AND user types AND budget categories
    data = pd.get_dummies(data, columns=['Category', 'UserType', 'budget_category'], drop_first=False)

    print("Universal feature set ready:", data.shape)

    # Feature selection - now includes budget and user type features
    FEATURES = [
        'lag_1', 'lag_2', 'lag_3', 'lag_12',
        'Rolling3', 'Rolling6', 'Rolling12',
        'Rolling3_Median', 'Volatility_6',
        'trend_3', 'pct_change',
        'month_num', 'month_sin', 'month_cos',
        'log_total_budget', 'spend_ratio', 'category_ratio'
    ] + [col for col in data.columns if col.startswith(('Category_', 'UserType_', 'budget_category_'))]

    # Sort strictly by date first to ensure temporal order
    data = data.sort_values(by=['Date', 'UserType', 'Category'])

    # Define a cutoff date for validation (e.g., keep last 3 months for testing)
    cutoff_date = data['Date'].max() - pd.DateOffset(months=3)

    train = data[data['Date'] <= cutoff_date].copy()
    test = data[data['Date'] > cutoff_date].copy()

    train_X = train[FEATURES]
    train_y = train['target']
    test_X = test[FEATURES]
    test_y = test['target']

    print(f"Training until {cutoff_date.date()}, Testing on {len(test)} rows after cutoff.")
    print(f"Features: {len(FEATURES)}")

    # Optuna optimization
    def objective(trial):
        n_estimators = trial.suggest_int('n_estimators', 300, 800)
        max_depth = trial.suggest_int('max_depth', 6, 12)
        lr = trial.suggest_float('learning_rate', 0.03, 0.15)
        reg_lambda = trial.suggest_float('reg_lambda', 0.1, 2.0)
        reg_alpha = trial.suggest_float('reg_alpha', 0.0, 1.0)
        monotonic_constraints = {}
        for feat in FEATURES:
            if feat == 'log_total_budget':
                monotonic_constraints[feat] = 1
            elif feat == 'lag_1': # Generally, if last month was high, next is likely high
                monotonic_constraints[feat] = 1
            else:
                monotonic_constraints[feat] = 0
        
        model = XGBRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=lr,
            mono_constraints=monotonic_constraints,
            reg_lambda=reg_lambda,
            reg_alpha=reg_alpha,
            random_state=42,
            eval_metric="mae",
            objective="reg:absoluteerror",
            verbosity=0,
        )

        # Weight recent data
        weights = np.linspace(0.7, 1.3, len(train_y))

        # Validation split
        split_idx = int(len(train_X) * 0.85)
        X_train_sub, X_val_sub = train_X.iloc[:split_idx], train_X.iloc[split_idx:]
        y_train_sub, y_val_sub = train_y.iloc[:split_idx], train_y.iloc[split_idx:]
        weights_sub = weights[:split_idx]

        model.fit(
            X_train_sub,
            y_train_sub,
            sample_weight=weights_sub,
            eval_set=[(X_val_sub, y_val_sub)],
            verbose=False
        )

        preds_val = model.predict(X_val_sub)
        mae_val = mean_absolute_error(y_val_sub, preds_val)
        
        return mae_val

    print("🔄 Optimizing hyperparameters for universal model...")
    study = optuna.create_study(direction='minimize')
    study.optimize(objective, n_trials=30, show_progress_bar=True)

    print(f"\nBest trial MAE: {study.best_trial.value:.4f}")

    # Final model
    best_xgb = XGBRegressor(
        **study.best_trial.params,
        random_state=42,
        eval_metric="mae",
        objective="reg:absoluteerror",
        verbosity=0,
    )

    weights = np.linspace(0.7, 1.3, len(train_y))

    best_xgb.fit(
        train_X,
        train_y,
        sample_weight=weights,
        eval_set=[(test_X, test_y)],
        verbose=False
    )

    # Evaluate
    preds = best_xgb.predict(test_X)
    predicted_expense_rupees = np.expm1(preds)
    actual_expense_rupees = np.expm1(test_y)

    mae_log = mean_absolute_error(test_y, preds)
    rmse_log = np.sqrt(mean_squared_error(test_y, preds))
    mae_rupees = mean_absolute_error(actual_expense_rupees, predicted_expense_rupees)
    rmse_rupees = np.sqrt(mean_squared_error(actual_expense_rupees, predicted_expense_rupees))

    print(f"\n🌍 Universal XGBoost Model Results:")
    print(f" MAE (log scale): {mae_log:.4f}")
    print(f" RMSE (log scale): {rmse_log:.4f}")
    print(f" MAE (rupees): ₹{mae_rupees:.2f}")
    print(f" RMSE (rupees): ₹{rmse_rupees:.2f}")

    # Feature importance
    feature_importance = sorted(zip(FEATURES, best_xgb.feature_importances_), 
                               key=lambda x: x[1], reverse=True)
    print(f"\n🔍 Top 10 Most Important Features:")
    for feature, importance in feature_importance[:10]:
        print(f" {feature}: {importance:.4f}")

    # Save universal model
    model_data = {
        "model": best_xgb,
        "features": FEATURES,
        "best_params": study.best_trial.params,
        "mae_log": mae_log,
        "rmse_log": rmse_log,
        "mae_rupees": mae_rupees,
        "rmse_rupees": rmse_rupees,
        "training_info": "Universal model trained on all user types and spending ranges",
        "user_types": ['college_student', 'young_professional', 'family_moderate', 
                      'family_high', 'luxury_lifestyle', 'senior_retired'],
        "budget_range": [3000, 60000]
    }

    joblib.dump(model_data, "expense_forecast_universal.pkl")
    print(f"\n💾 Universal model saved as 'expense_forecast_universal.pkl'")
    print(f"   - Features: {len(FEATURES)}")
    print(f"   - User types: 6 archetypes")
    print(f"   - Budget range: ₹3,000 - ₹60,000")
    print(f"   - Test MAE: ₹{mae_rupees:.2f}")
    
    return model_data

if __name__ == "__main__":
    model_data = train_universal_model()
    print("\n🌍 Universal model training complete!")
    print("This model can handle users from ₹3,000/month to ₹60,000/month!")