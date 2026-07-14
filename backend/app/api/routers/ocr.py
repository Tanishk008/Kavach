"""OCR router for extracting text from images (screenshots)."""

import asyncio
import logging
import os
import ssl
import tempfile
from concurrent.futures import ThreadPoolExecutor
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/heic", "application/octet-stream"
}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}

# Thread pool for CPU-bound OCR tasks
_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ocr_analysis")

# Global reader instance so it only initializes once
_reader = None

def _get_reader():
    global _reader
    if _reader is None:
        import easyocr
        # Bypass SSL verification for model downloads in some macOS environments
        ssl._create_default_https_context = ssl._create_unverified_context
        _reader = easyocr.Reader(['en'], gpu=False)  # Force CPU for basic local setup
    return _reader

class OCRExtractResponse(BaseModel):
    text: str
    lines: List[str]
    confidence: float

def _extract_text_sync(path: str) -> OCRExtractResponse:
    """CPU-bound text extraction."""
    reader = _get_reader()
    
    # Read text from image
    result = reader.readtext(path)
    
    if not result:
        return OCRExtractResponse(text="", lines=[], confidence=0.0)
    
    lines = []
    total_conf = 0.0
    valid_boxes = 0
    
    for bbox, text, conf in result:
        lines.append(text)
        if conf > 0.0:
            total_conf += conf
            valid_boxes += 1
            
    avg_conf = (total_conf / valid_boxes) if valid_boxes > 0 else 0.0
    full_text = "\n".join(lines)
    
    return OCRExtractResponse(
        text=full_text,
        lines=lines,
        confidence=round(avg_conf, 2)
    )

@router.post("/extract", response_model=OCRExtractResponse)
async def extract_text(image: UploadFile = File(...)) -> OCRExtractResponse:
    """Extract text from an uploaded image using OCR."""
    content_type = (image.content_type or "").lower()
    filename = image.filename or "image"
    ext = os.path.splitext(filename)[1].lower()

    if content_type not in ALLOWED_CONTENT_TYPES and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Supported: jpeg, png, webp.",
        )

    data = await image.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Image file too large (max 5 MB).")

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(_EXECUTOR, _extract_text_sync, tmp_path),
            timeout=30.0,
        )
        return result
    except asyncio.TimeoutError:
        logger.error("OCR extraction timed out for file: %s", filename)
        raise HTTPException(status_code=504, detail="OCR extraction timed out. Please try a smaller image.")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
