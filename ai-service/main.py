from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import joblib
import pandas as pd
import numpy as np
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Smart Shepherd AI Service")

# Load models
MODEL_PATH = "models/status_classifier.joblib"
ANOMALY_PATH = "models/anomaly_detector.joblib"

class GPSData(BaseModel):
    latitude: float
    longitude: float

class PredictionInput(BaseModel):
    animal_id: str
    temperature: float
    heart_rate: float
    activity: float
    speed: float
    gps: Optional[GPSData] = None
    history: Optional[List[dict]] = []

class PredictionOutput(BaseModel):
    status: str
    risk_score: int
    cause: str
    recommendation: str
    confidence: float

# Helper to load models on startup
@app.on_event("startup")
def load_models():
    if not os.path.exists(MODEL_PATH) or not os.path.exists(ANOMALY_PATH):
        logger.warning("Models not found! Serving with fallback logic. Run trainer.py first.")

@app.post("/ai/predict", response_model=PredictionOutput)
async def predict(data: PredictionInput):
    try:
        # Load models
        try:
            clf = joblib.load(MODEL_PATH)
            anom = joblib.load(ANOMALY_PATH)
        except:
            # Fallback mock logic if models missing
            return fallback_prediction(data)

        # Prepare features
        features = pd.DataFrame([{
            'temperature': data.temperature,
            'heart_rate': data.heart_rate,
            'activity': data.activity,
            'speed': data.speed
        }])

        # Classification
        status_idx = clf.predict(features)[0]
        status_map = {0: "NORMAL", 1: "ATTENTION", 2: "CRITICAL"}
        status = status_map.get(status_idx, "UNKNOWN")

        # Risk Score Calculation
        probs = clf.predict_proba(features)[0]
        risk_score = int((probs[1] * 50) + (probs[2] * 100))
        confidence = float(np.max(probs))

        # Anomaly Detection
        is_anomaly = anom.predict(features)[0] == -1

        # Cause & Recommendation Logic
        cause = "Stability detected"
        recommendation = "No action needed"

        if status == "CRITICAL":
            cause = "Critical physiological metrics (High Fever/HR)"
            recommendation = "Emergency! Check animal immediately."
        elif status == "ATTENTION":
            cause = "Elevated temperature or irregular activity"
            recommendation = "Monitor animal closely. Possible early signs of stress."
        
        if is_anomaly and status == "NORMAL":
            status = "ATTENTION"
            cause = "Behavioral anomaly detected"
            recommendation = "Observe behavior for suspicious movement."

        return PredictionOutput(
            status=status,
            risk_score=min(risk_score, 100),
            cause=cause,
            recommendation=recommendation,
            confidence=confidence
        )

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def fallback_prediction(data: PredictionInput):
    # Basic rule-based fallback if models aren't ready
    status = "NORMAL"
    risk_score = 10
    cause = "Normal range"
    recommendation = "Keep monitoring"

    if data.temperature > 40.5:
        status = "CRITICAL"
        risk_score = 90
        cause = "High fever detected"
        recommendation = "Immediate veterinary check required"
    elif data.temperature > 39.5 or data.activity < 10:
        status = "ATTENTION"
        risk_score = 60
        cause = "Sub-optimal metrics"
        recommendation = "Inspect animal today"

    return PredictionOutput(
        status=status,
        risk_score=risk_score,
        cause=cause,
        recommendation=recommendation,
        confidence=0.85
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
