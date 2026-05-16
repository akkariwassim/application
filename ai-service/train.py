import pandas as pd
import numpy as np
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DATASET_PATH = "datasets/php3CTpvq.csv"
MODEL_DIR = "trained_models"

def load_data(file_path):
    logger.info(f"Loading data from {file_path}")
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    data_start = 0
    headers = []
    for i, line in enumerate(lines):
        if line.strip() == '@data':
            data_start = i + 1
            break
        if line.startswith('@attribute'):
            headers.append(line.split()[1])
            
    df = pd.read_csv(file_path, skiprows=data_start, names=headers)
    return df

def preprocess_data(df):
    logger.info("Preprocessing data...")
    
    # Remove duplicates
    df = df.drop_duplicates()
    
    # Handle missing values (though none detected)
    df = df.dropna()
    
    # Feature Engineering / Mapping
    # We map V1-V4 to the logical features for the app
    # V1: Time -> Speed
    # V2: AccelX -> Temperature
    # V3: AccelY -> Heart Rate
    # V4: AccelZ -> Activity
    
    # Map Class (1-22) to Status (NORMAL, ATTENTION, CRITICAL)
    # Heuristic mapping:
    # 1-8: NORMAL (Walking, Grazing, Standing)
    # 9-16: ATTENTION (Running, Irregular)
    # 17-22: CRITICAL (Lying down, Panic)
    def map_class_to_status(c):
        if c <= 8: return "NORMAL"
        if c <= 16: return "ATTENTION"
        return "CRITICAL"
    
    df['status'] = df['Class'].apply(map_class_to_status)
    
    X = df[['V1', 'V2', 'V3', 'V4']]
    y = df['status']
    
    # Encoding target
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    # Splitting
    X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42)
    
    # Scaling
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    return X_train_scaled, X_test_scaled, y_train, y_test, scaler, le

def train_models(X_train, X_test, y_train, y_test):
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
        "XGBoost": XGBClassifier(use_label_encoder=False, eval_metric='mlogloss', random_state=42),
        "LightGBM": LGBMClassifier(random_state=42),
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Gradient Boosting": GradientBoostingClassifier(random_state=42)
    }
    
    best_model = None
    best_f1 = 0
    results = {}
    
    for name, model in models.items():
        logger.info(f"Training {name}...")
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, average='weighted')
        rec = recall_score(y_test, y_pred, average='weighted')
        f1 = f1_score(y_test, y_pred, average='weighted')
        
        results[name] = {"Accuracy": acc, "Precision": prec, "Recall": rec, "F1": f1}
        logger.info(f"{name} - F1 Score: {f1:.4f}")
        
        if f1 > best_f1:
            best_f1 = f1
            best_model = model
            best_model_name = name
            
    return best_model, best_model_name, results

def save_artifacts(model, scaler, encoder):
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)
        
    joblib.dump(model, f"{MODEL_DIR}/best_model.joblib")
    joblib.dump(scaler, f"{MODEL_DIR}/scaler.joblib")
    joblib.dump(encoder, f"{MODEL_DIR}/encoder.joblib")
    logger.info(f"Artifacts saved to {MODEL_DIR}")

def main():
    df = load_data(DATASET_PATH)
    X_train, X_test, y_train, y_test, scaler, le = preprocess_data(df)
    
    best_model, best_name, results = train_models(X_train, X_test, y_train, y_test)
    
    logger.info(f"\n--- Best Model: {best_name} ---")
    logger.info(f"F1 Score: {results[best_name]['F1']:.4f}")
    
    save_artifacts(best_model, scaler, le)
    
    # Save a summary report
    with open("training_report.txt", "w") as f:
        f.write("AI Training Report\n")
        f.write("==================\n\n")
        for name, metrics in results.items():
            f.write(f"{name}:\n")
            for m, v in metrics.items():
                f.write(f"  {m}: {v:.4f}\n")
            f.write("\n")
        f.write(f"Best Model: {best_name}\n")

if __name__ == "__main__":
    main()
