"""
chat.py (router)
PURPOSE: API route for the assistant. Safety rules run first, then the AI (or demo mode).
DEPENDS ON: schemas.py, services/safety.py, services/ai_assistant.py
USED BY: main.py
"""
from fastapi import APIRouter

from app.schemas import ChatIn
from app.services import ai_assistant, safety

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
def chat(payload: ChatIn):
    """Returns {'reply', 'mode'} where mode is 'safety', 'ai' or 'demo'."""
    safe_reply = safety.check_message(payload.message, payload.language)
    if safe_reply:
        return {"reply": safe_reply, "mode": "safety"}
    return ai_assistant.answer(payload.message, payload.language)