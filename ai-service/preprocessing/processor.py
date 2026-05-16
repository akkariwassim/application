import joblib
import pandas as pd
import numpy as np
import os

class DataProcessor:
    def __init__(self, model_dir="trained_models"):
        self.scaler = joblib.load(os.path.join(model_dir, "scaler.joblib"))
        self.encoder = joblib.load(os.path.join(model_dir, "encoder.joblib"))
        
    def preprocess(self, data):
        # Map input fields to V1-V4
        # speed -> V1
        # temperature -> V2
        # heart_rate -> V3
        # activity -> V4
        
        features = pd.DataFrame([{
            'V1': data.get('speed', 0),
            'V2': data.get('temperature', 38),
            'V3': data.get('heart_rate', 80),
            'V4': data.get('activity', 50)
        }])
        
        # We need to ensure the columns are in the same order as training
        features = features[['V1', 'V2', 'V3', 'V4']]
        
        scaled_features = self.scaler.transform(features)
        return scaled_features

    def decode_label(self, label_idx):
        return self.encoder.inverse_transform([label_idx])[0]
