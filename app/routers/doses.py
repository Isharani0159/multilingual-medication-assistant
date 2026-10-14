"""
doses.py (router)
PURPOSE: API routes to list a day's doses and record the patient's self-reported status.
DEPENDS ON: database.py, models.py, schemas.py, services/scheduler.py
USED BY: main.py
"""
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DoseLog
from app.schemas import DoseStatusIn
from app.services import scheduler

router = APIRouter(prefix="/api/doses", tags=["doses"])


@router.get("")
def list_doses(day: date, now: Optional[datetime] = None, db: Session = Depends(get_db)):
    """Returns all doses for `day`. The browser sends its LOCAL time in `now`
    (e.g. 2026-10-13T14:30) so statuses are right even if the server is in another timezone."""
    return scheduler.get_day_doses(db, day, now or datetime.now())


@router.patch("/{dose_id}")
def set_dose_status(dose_id: int, data: DoseStatusIn, db: Session = Depends(get_db)):
    """Records taken / skipped / missed (self-reported), or 'scheduled' to undo."""
    log = db.get(DoseLog, dose_id)
    if not log:
        raise HTTPException(status_code=404, detail="Dose not found")
    log.status = data.status
    log.recorded_at = None if data.status == "scheduled" else datetime.utcnow()
    db.commit()
    return {"id": log.id, "status": log.status}