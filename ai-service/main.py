from fastapi import FastAPI
from routes import ai_routes
from utils.logger import setup_logger
import uvicorn
import os

logger = setup_logger()

app = FastAPI(
    title="Professional AI Shepherd Service",
    description="Livestock monitoring AI service powered by FastAPI and XGBoost",
    version="2.0.0"
)

# Include routes
app.include_router(ai_routes.router, prefix="/ai", tags=["AI"])

@app.get("/")
async def root():
    return {"status": "online", "service": "Smart Shepherd AI", "version": "2.0.0"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
