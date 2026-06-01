"""
OCR Service — processes uploaded images to extract text on the backend.
Uses pytesseract wrapper around Google Tesseract OCR engine.
"""

import base64
import io
import logging
from PIL import Image
import pytesseract

logger = logging.getLogger("nexus.ocr")


def extract_text_from_base64_image(base64_str: str) -> str:
    """
    Extract text from a base64-encoded image string using Tesseract OCR.
    Supports English, French, and Arabic.
    """
    try:
        # Strip data URL prefix if present (e.g. "data:image/png;base64,iVBOR...")
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]

        # Decode base64 to bytes
        image_bytes = base64.b64decode(base64_str)
        
        # Load image with Pillow
        image = Image.open(io.BytesIO(image_bytes))

        # Perform OCR using pytesseract with eng+fra+ara
        # Config directs Tesseract to use English, French, and Arabic language packs
        text = pytesseract.image_to_string(image, lang="eng+fra+ara")
        
        return text.strip()
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        return f"[OCR Failed: {str(e)}]"
