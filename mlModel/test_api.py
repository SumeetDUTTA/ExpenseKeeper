from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

# Simple test API without pandas dependency
app = FastAPI(title='Simple Test API', version='1.0')

# Test if we can load the model
try:
    MODEL_PATH = "expense_forecast.pkl"
    model_package = joblib.load(MODEL_PATH)
    model = model_package['model']
    FEATURES = model_package['features']
    print(f"Model loaded successfully. Features: {len(FEATURES)}")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None
    FEATURES = []

class ExpenseData(BaseModel):
    Date: str
    Amount: float
    Category: str
    Type: str

@app.get("/")
async def root():
    return {"message": "Test API is working!", "model_loaded": model is not None}

@app.get("/features")
async def get_features():
    return {"features": FEATURES, "feature_count": len(FEATURES)}

@app.post("/test-predict")
async def test_predict():
    """Test prediction with dummy data"""
    if model is None:
        return {"error": "Model not loaded"}
    
    # Create dummy features (same length as expected)
    dummy_features = np.zeros((1, len(FEATURES)))
    
    try:
        prediction = model.predict(dummy_features)[0]
        return {"prediction": float(prediction), "status": "success"}
    except Exception as e:
        return {"error": str(e)}