"""
models.py
PURPOSE: Defines the database tables (Medication and DoseLog).
DEPENDS ON: database.py
USED BY: schemas.py (indirectly), services/*, routers/*, main.py
"""
from datetime import date, datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Medication(Base):
    """One prescribed medicine entered by the user (no doses are invented by the app)."""
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    dose: Mapped[str] = mapped_column(String(100))          # text exactly as entered, e.g. "1 tablet"
    notes: Mapped[str] = mapped_column(String(300), default="")
    times: Mapped[str] = mapped_column(String(100))         # comma separated "08:00,20:00"
    start_date: Mapped[date]
    end_date: Mapped[Optional[date]] = mapped_column(default=None)
    active: Mapped[bool] = mapped_column(default=True)

    logs: Mapped[list["DoseLog"]] = relationship(back_populates="medication", cascade="all, delete-orphan")


class DoseLog(Base):
    """One scheduled dose on one date, plus what the patient reported (self-reported)."""
    __tablename__ = "dose_logs"
    # Same medicine + date + time can exist only once -> no duplicate records
    __table_args__ = (UniqueConstraint("medication_id", "scheduled_date", "scheduled_time"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    medication_id: Mapped[int] = mapped_column(ForeignKey("medications.id", ondelete="CASCADE"))
    scheduled_date: Mapped[date]
    scheduled_time: Mapped[str] = mapped_column(String(5))   # "HH:MM"
    # Stored statuses: scheduled | taken | missed | skipped
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    recorded_at: Mapped[Optional[datetime]] = mapped_column(default=None)

    medication: Mapped["Medication"] = relationship(back_populates="logs")