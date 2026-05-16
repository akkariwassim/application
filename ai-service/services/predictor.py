import joblib
import os
import numpy as np
from preprocessing.processor import DataProcessor

class AIPredictor:
    def __init__(self, model_dir="trained_models"):
        self.model = joblib.load(os.path.join(model_dir, "best_model.joblib"))
        self.processor = DataProcessor(model_dir)
        
    def predict(self, input_data):
        # input_data is a dict with temperature, heart_rate, activity, speed, etc.
        processed_data = self.processor.preprocess(input_data)
        
        # Prediction
        label_idx = self.model.predict(processed_data)[0]
        status = self.processor.decode_label(label_idx)
        
        # Risk Score (based on probabilities if available)
        probs = self.model.predict_proba(processed_data)[0]
        # Map probabilities to a score 0-100
        # Assuming classes are NORMAL (0), ATTENTION (1), CRITICAL (2)
        # Check encoder order
        classes = self.processor.encoder.classes_
        
        risk_score = 0
        if "NORMAL" in classes:
            idx_normal = np.where(classes == "NORMAL")[0][0]
            risk_score += (1 - probs[idx_normal]) * 100
        
        # Confidence
        confidence = float(np.max(probs))
        
        # Generate recommendation
        recommendation = "Keep monitoring the animal."
        cause = "Stability detected."
        
        if status == "CRITICAL":
            cause = "Critical behavioral pattern detected."
            recommendation = "Emergency! Check animal immediately."
        elif status == "ATTENTION":
            cause = "Irregular movement or physiological metrics."
            recommendation = "Monitor animal closely for further signs of stress."
            
        return {
            "status": status,
            "risk_score": int(min(risk_score, 100)),
            "prediction": f"{status} state detected",
            "recommendation": recommendation,
            "cause": cause,
            "confidence": confidence
        }
