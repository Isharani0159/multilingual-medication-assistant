"""
database.py
PURPOSE: Creates the SQLAlchemy engine and session factory.
DEPENDS ON: config.py
USED BY: models.py, main.py, all routers
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

# SQLite needs this flag because FastAPI uses multiple threads
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Factory that creates a new database session per request
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    """Parent class for all database table classes."""


def get_db():
    """FastAPI dependency: opens a session for one request and always closes it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()