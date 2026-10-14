"""
reports.py (router)
PURPOSE: API route that builds the weekly adherence report.
DEPENDS ON: database.py, services/scheduler.py, services/adherence.py
USED BY: main.py
"""
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import adherence, scheduler

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/weekly")
def weekly_report(day: date, now: Optional[datetime] = None, db: Session = Depends(get_db)):
    """Summary for the 7 days ending on `day`, plus a per-day breakdown for the bar chart."""
    now = now or datetime.now()
    all_doses, days = [], []
    for offset in range(6, -1, -1):
        current = day - timedelta(days=offset)
        doses = scheduler.get_day_doses(db, current, now)
        summary = adherence.summarize(doses)
        days.append({"date": current.isoformat(), "taken": summary["taken"], "counted": summary["counted"]})
        all_doses.extend(doses)
    return {**adherence.summarize(all_doses), "days": days}