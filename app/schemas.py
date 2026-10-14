"""
schemas.py
PURPOSE: Validates incoming request data and shapes outgoing responses (Pydantic).
DEPENDS ON: nothing from the project
USED BY: routers/medications.py, routers/doses.py, routers/chat.py
"""
import re
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Accepts 00:00 to 23:59
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class MedicationIn(BaseModel):
    """Data the user submits when adding or editing a medicine."""
    name: str = Field(min_length=1, max_length=100)
    dose: str = Field(min_length=1, max_length=100)
    notes: str = Field(default="", max_length=300)
    times: list[str] = Field(min_length=1, max_length=8)
    start_date: date
    end_date: Optional[date] = None

    @field_validator("name", "dose", "notes")
    @classmethod
    def strip_text(cls, value, info):
        """Trims spaces; name and dose must not be blank."""
        value = value.strip()
        if info.field_name in ("name", "dose") and not value:
            raise ValueError(f"{info.field_name} is required")
        return value

    @field_validator("times")
    @classmethod
    def check_times(cls, values):
        """Ensures every time is HH:MM, removes duplicates and sorts them."""
        for v in values:
            if not TIME_RE.match(v):
                raise ValueError(f"invalid time: {v}")
        return sorted(set(values))

    @model_validator(mode="after")
    def check_dates(self):
        """End date cannot be before start date."""
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class MedicationOut(BaseModel):
    """Medicine data sent back to the browser."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    dose: str
    notes: str
    times: list[str]
    start_date: date
    end_date: Optional[date]
    active: bool

    @field_validator("times", mode="before")
    @classmethod
    def split_times(cls, v):
        """Database stores times as '08:00,20:00'; convert to a list."""
        return v.split(",") if isinstance(v, str) else v


class DoseStatusIn(BaseModel):
    """Status the patient reports. 'scheduled' means 'undo'."""
    status: Literal["taken", "missed", "skipped", "scheduled"]


class ChatIn(BaseModel):
    """A chat question and the interface language."""
    message: str = Field(min_length=1, max_length=500)
    language: Literal["en", "ur", "sd"] = "en"