"""
ocr.py (router)
PURPOSE: API route that receives a prescription photo and returns the data for the review screen.
         The photo is processed in memory only and is never written to disk or the database.
DEPENDS ON: services/prescription_ocr.py
USED BY: main.py
"""
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services import prescription_ocr as ocr

router = APIRouter(prefix="/api/ocr", tags=["ocr"])


@router.post("/extract")
def extract(file: UploadFile = File(...)):
    """Returns {'is_prescription', 'medicines': [...]} for the browser's confirmation screen.
    Error 'detail' is a short code like 'ocr_too_big' that the frontend translates."""
    if file.content_type not in ocr.ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="ocr_bad_type")
    data = file.file.read(ocr.MAX_BYTES + 1)  # read one byte more than the limit to detect oversize
    if len(data) > ocr.MAX_BYTES:
        raise HTTPException(status_code=413, detail="ocr_too_big")
    if not data:
        raise HTTPException(status_code=400, detail="ocr_bad_image")
    try:
        return ocr.extract(data, file.content_type)
    except ocr.OcrError as err:
        raise HTTPException(status_code=err.status, detail=err.code)