import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.ensemble import IsolationForest
import joblib
import os

# Create directories if not exist
os.makedirs('models', exist_ok=True)

def generate_synthetic_data(n_samples=2000):
    np.random.seed(42)
    
    # NORMAL data
    normal_temp = np.random.normal(38.5, 0.5, n_samples // 2)
    normal_hr = np.random.normal(75, 5, n_samples // 2)
    normal_activity = np.random.normal(50, 10, n_samples // 2)
    normal_speed = np.random.normal(0.5, 0.2, n_samples // 2)
    
    # ATTENTION data (Fever or High Activity)
    fever_temp = np.random.normal(40.5, 0.5, n_samples // 4)
    fever_hr = np.random.normal(90, 10, n_samples // 4)
    fever_activity = np.random.normal(30, 10, n_samples // 4)
    fever_speed = np.random.normal(0.2, 0.1, n_samples // 4)
    
    # CRITICAL data (High Fever + Extreme Activity or No Movement)
    danger_temp = np.random.normal(41.5, 0.5, n_samples // 4)
    danger_hr = np.random.normal(110, 15, n_samples // 4)
    danger_activity = np.random.normal(10, 5, n_samples // 4)
    danger_speed = np.random.normal(0.05, 0.02, n_samples // 4)
    
    # Combine
    X = pd.DataFrame({
        'temperature': np.concatenate([normal_temp, fever_temp, danger_temp]),
        'heart_rate': np.concatenate([normal_hr, fever_hr, danger_hr]),
        'activity': np.concatenate([normal_activity, fever_activity, danger_activity]),
        'speed': np.concatenate([normal_speed, fever_speed, danger_speed])
    })
    
    # Labels: 0=NORMAL, 1=ATTENTION, 2=CRITICAL
    y = np.concatenate([
        np.zeros(n_samples // 2),
        np.ones(n_samples // 4),
        np.full(n_samples // 4, 2)
    ])
    
    return X, y

def train():
    print("Generating synthetic data...")
    X, y = generate_synthetic_data()
    
    print("Training XGBoost Classifier...")
    model = XGBClassifier(n_estimators=100, max_depth=5, learning_rate=0.1)
    model.fit(X, y)
    joblib.dump(model, 'models/status_classifier.joblib')
    
    print("Training Isolation Forest Anomaly Detector...")
    iso_forest = IsolationForest(contamination=0.05, random_state=42)
    iso_forest.fit(X)
    joblib.dump(iso_forest, 'models/anomaly_detector.joblib')
    
    print("✅ Models trained and saved in models/")

if __name__ == "__main__":
    train()
