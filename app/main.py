"""
main.py
PURPOSE: Creates the FastAPI app, creates database tables, mounts routers, serves the frontend.
DEPENDS ON: config.py, database.py, models.py, routers/*
RUN WITH: uvicorn app.main:app --reload
"""
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401  (imported so tables are registered)
from app.config import BASE_DIR
from app.database import Base, engine
from app.routers import chat, doses, medications, ocr, reports

# Create tables if they do not exist yet
Base.metadata.create_all(bind=engine)

app = FastAPI(title="MedAssist - Multilingual Medication Adherence Assistant")

app.include_router(medications.router)
app.include_router(doses.router)
app.include_router(reports.router)
app.include_router(ocr.router)

# Serve CSS / JS files at /static/...
app.mount("/static", StaticFiles(directory=BASE_DIR / "app" / "static"), name="static")


@app.get("/api/health")
def health():
    """Simple check used to confirm the server is running."""
    return {"status": "ok"}


@app.get("/")
def index():
    """Serves the single-page frontend."""
    return FileResponse(BASE_DIR / "app" / "templates" / "index.html")