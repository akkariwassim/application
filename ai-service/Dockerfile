FROM python:3.11

WORKDIR /app

# Ensure pip is up to date
RUN pip install --no-cache-dir --upgrade pip

# Install dependencies directly to avoid local file issues
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    pandas \
    numpy \
    scikit-learn \
    xgboost \
    python-dotenv \
    pydantic \
    joblib

# Copy the rest of the application
COPY . .

# Pre-train models
RUN python training/trainer.py

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
