"""
scheduler.py
PURPOSE: Creates dose records for a day and works out each dose's display status.
DEPENDS ON: models.py, config.py
USED BY: routers/doses.py, routers/reports.py
"""
from datetime import date, datetime, timedelta, time as dtime

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import MISSED_GRACE_MINUTES
from app.models import DoseLog, Medication


def ensure_logs(db: Session, day: date) -> None:
    """Creates a 'scheduled' DoseLog for every active medicine time on `day`.
    Existing records are never duplicated (checked here AND by the unique constraint)."""
    meds = db.scalars(
        select(Medication).where(
            Medication.active.is_(True),
            Medication.start_date <= day,
            or_(Medication.end_date.is_(None), Medication.end_date >= day),
        )
    ).all()
    existing = {
        (log.medication_id, log.scheduled_time)
        for log in db.scalars(select(DoseLog).where(DoseLog.scheduled_date == day))
    }
    created = False
    for med in meds:
        for tm in med.times.split(","):
            if (med.id, tm) not in existing:
                db.add(DoseLog(medication_id=med.id, scheduled_date=day, scheduled_time=tm))
                created = True
    if created:
        try:
            db.commit()
        except IntegrityError:  # two requests raced; the unique constraint protected us
            db.rollback()


def derive_status(log: DoseLog, now: datetime) -> str:
    """Turns stored status + current time into a display status:
    taken/missed/skipped (patient-reported), or upcoming / due / pending_confirmation."""
    if log.status != "scheduled":
        return log.status
    due = datetime.combine(log.scheduled_date, dtime.fromisoformat(log.scheduled_time))
    if now < due:
        return "upcoming"
    if now <= due + timedelta(minutes=MISSED_GRACE_MINUTES):
        return "due"
    return "pending_confirmation"  # time passed, patient never reported -> uncertain


def get_day_doses(db: Session, day: date, now: datetime) -> list[dict]:
    """Returns all doses of `day` (sorted by time) as dictionaries for the API."""
    ensure_logs(db, day)
    rows = db.execute(
        select(DoseLog, Medication)
        .join(Medication, Medication.id == DoseLog.medication_id)
        .where(DoseLog.scheduled_date == day)
        .order_by(DoseLog.scheduled_time, Medication.name)
    ).all()
    result = []
    for log, med in rows:
        # Hide stale scheduled doses of deactivated medicines or removed times
        if log.status == "scheduled" and (not med.active or log.scheduled_time not in med.times.split(",")):
            continue
        result.append({
            "id": log.id,
            "medication_id": med.id,
            "name": med.name,
            "dose": med.dose,
            "notes": med.notes,
            "scheduled_date": log.scheduled_date.isoformat(),
            "scheduled_time": log.scheduled_time,
            "status": derive_status(log, now),
            "recorded_at": log.recorded_at.isoformat() if log.recorded_at else None,
        })
    return result