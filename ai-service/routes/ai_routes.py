from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.predictor import AIPredictor
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Global predictor instance
predictor = None

def get_predictor():
    global predictor
    if predictor is None:
        try:
            predictor = AIPredictor()
        except Exception as e:
            logger.error(f"Failed to load predictor: {e}")
            raise e
    return predictor

class GPSData(BaseModel):
    latitude: float
    longitude: float

class PredictionInput(BaseModel):
    temperature: float
    heart_rate: float
    activity: float
    speed: float
    gps: Optional[GPSData] = None
    gps_distance: Optional[float] = 0
    animal_id: Optional[str] = None

class PredictionOutput(BaseModel):
    status: str
    risk_score: int
    prediction: str
    recommendation: str
    cause: str
    confidence: float

@router.post("/predict", response_model=PredictionOutput)
async def predict(data: PredictionInput):
    try:
        p = get_predictor()
        result = p.predict(data.dict())
        return result
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
