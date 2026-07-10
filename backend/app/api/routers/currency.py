"""Counterfeit currency detection router."""
from fastapi import APIRouter, File, UploadFile

from app.schemas.currency import CurrencyCheckResponse
from app.services import currency

router = APIRouter(prefix="/api/currency", tags=["currency"])


@router.post("/check", response_model=CurrencyCheckResponse)
async def check_currency(image: UploadFile = File(...)) -> CurrencyCheckResponse:
    image_bytes = await image.read()
    return currency.analyze_note(image_bytes, image.filename or "")
