# Smart Shepherd AI Service

Professional Machine Learning service for real-time livestock monitoring and health prediction.

## Overview
This service replaces the legacy AI system with a production-grade pipeline based on the `php3CTpvq.csv` dataset. It uses a FastAPI backend to serve predictions from a trained Random Forest / XGBoost model.

## Features
- **Real-time Prediction**: `POST /ai/predict` endpoint for animal health status.
- **Model Training**: Automated training pipeline with evaluation metrics (Accuracy, Precision, Recall, F1).
- **Professional Preprocessing**: Standard scaling and label encoding.
- **Microservice Architecture**: Decoupled from the main Node.js backend.

## Tech Stack
- **Python 3.10+**
- **FastAPI** (Web Framework)
- **Scikit-learn / XGBoost / LightGBM** (Machine Learning)
- **Pandas / Numpy** (Data Manipulation)
- **Joblib** (Model Serialization)

## Installation
```bash
pip install -r requirements.txt
```

## Training the Model
To retrain the model with the latest dataset:
```bash
python train.py
```
This will evaluate multiple models and save the best-performing one to `trained_models/`.

## Running the Service
```bash
python main.py
```
The service will be available at `http://localhost:8000`.

## API Endpoint
### POST `/ai/predict`
**Input:**
```json
{
  "temperature": 39.2,
  "heart_rate": 115,
  "activity": 42,
  "speed": 3.1,
  "gps": {
    "latitude": 35.038,
    "longitude": 9.484
  }
}
```

**Output:**
```json
{
  "status": "WARNING",
  "risk_score": 76,
  "prediction": "High stress detected",
  "recommendation": "Monitor animal and reduce movement",
  "cause": "Irregular movement detected",
  "confidence": 0.89
}
```
