"""
medications.py (router)
PURPOSE: API routes to add, list, edit, deactivate and re-activate medicines.
DEPENDS ON: database.py, models.py, schemas.py
USED BY: main.py
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Medication
from app.schemas import MedicationIn, MedicationOut

router = APIRouter(prefix="/api/medications", tags=["medications"])


def _get_or_404(db: Session, med_id: int) -> Medication:
    """Finds a medicine by id or raises a 404 error."""
    med = db.get(Medication, med_id)
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    return med


@router.get("", response_model=list[MedicationOut])
def list_medications(include_inactive: bool = False, db: Session = Depends(get_db)):
    """Lists medicines (active only unless include_inactive=true)."""
    query = select(Medication).order_by(Medication.name)
    if not include_inactive:
        query = query.where(Medication.active.is_(True))
    return db.scalars(query).all()


@router.post("", response_model=MedicationOut, status_code=201)
def create_medication(data: MedicationIn, db: Session = Depends(get_db)):
    """Adds a new medicine exactly as the user entered it."""
    med = Medication(**data.model_dump(exclude={"times"}), times=",".join(data.times))
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


@router.put("/{med_id}", response_model=MedicationOut)
def update_medication(med_id: int, data: MedicationIn, db: Session = Depends(get_db)):
    """Edits an existing medicine."""
    med = _get_or_404(db, med_id)
    for field, value in data.model_dump(exclude={"times"}).items():
        setattr(med, field, value)
    med.times = ",".join(data.times)
    db.commit()
    db.refresh(med)
    return med


@router.post("/{med_id}/deactivate", response_model=MedicationOut)
def deactivate_medication(med_id: int, db: Session = Depends(get_db)):
    """Stops future reminders; history is kept."""
    med = _get_or_404(db, med_id)
    med.active = False
    db.commit()
    db.refresh(med)
    return med


@router.post("/{med_id}/activate", response_model=MedicationOut)
def activate_medication(med_id: int, db: Session = Depends(get_db)):
    """Turns reminders for a medicine back on."""
    med = _get_or_404(db, med_id)
    med.active = True
    db.commit()
    db.refresh(med)
    return med