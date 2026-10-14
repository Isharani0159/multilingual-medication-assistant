import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Database
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'medassist.db'}")

# Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# App Settings - ye pehle miss ho rahe the
MISSED_GRACE_MINUTES = int(os.getenv("MISSED_GRACE_MINUTES", "30"))
DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "en")

# Safety: agar koi aur purana naam import ho raha ho to crash na ho
def __getattr__(name):
    # Agar koi bhi aur variable maang liya jaye to default de do
    defaults = {
        "SECRET_KEY": "dev-secret",
        "ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": 1440,
    }
    if name in defaults:
        return defaults[name]
    raise AttributeError(f"module 'app.config' has no attribute '{name}'")