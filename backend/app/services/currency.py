"""Counterfeit currency detection (A.4).

Uses a trained PyTorch EfficientNet-B0 model to verify the authenticity of Indian currency notes.
"""
from __future__ import annotations
import logging

from app.schemas.currency import CurrencyCheckResponse
from app.ml.predictor import predict_image

logger = logging.getLogger(__name__)

_FEATURES = [
    "EfficientNet-B0 feature map validation",
    "Texture and paper fiber pattern analysis",
    "Security thread and watermark region assessment",
]


def analyze_note(image_bytes: bytes, filename: str = "") -> CurrencyCheckResponse:
    """Runs CV inference using the trained EfficientNet-B0 model.

    Returns the classification result (real vs fake), confidence score, and descriptive message.
    """
    if not image_bytes:
        return CurrencyCheckResponse(
            denomination=None,
            authenticity="uncertain",
            confidence=0.0,
            features_checked=[],
            message="This doesn't look like a currency note — please try again.",
        )

    try:
        # Run inference using the loaded model
        result = predict_image(image_bytes)
        
        prediction = result["prediction"]  # "Real" or "Fake"
        confidence_pct = result["confidence"]  # e.g., 96.83
        
        # Convert prediction to required lowercase format: "real" or "fake"
        authenticity = prediction.lower()
        
        # Convert confidence to a 0.0 - 1.0 fraction
        confidence_fraction = confidence_pct / 100.0

        # Map confidence levels and recommendations from predict.py
        if confidence_pct >= 95:
            level = "VERY HIGH"
            recommendation = "Model is highly confident."
        elif confidence_pct >= 85:
            level = "HIGH"
            recommendation = "Prediction appears reliable."
        elif confidence_pct >= 70:
            level = "MODERATE"
            recommendation = "Prediction is reasonably reliable."
        elif confidence_pct >= 60:
            level = "LOW"
            recommendation = "Manual verification recommended."
        else:
            level = "UNCERTAIN"
            recommendation = "Unable to classify confidently."

        status_text = "Likely Genuine" if authenticity == "real" else "Likely Counterfeit/Fake"
        message = (
            f"Prediction: {status_text}\n"
            f"Confidence: {confidence_pct:.2f}%\n"
            f"Confidence Level: {level}\n"
            f"Recommendation: {recommendation}"
        )

        return CurrencyCheckResponse(
            denomination=None,  # Binary classifier does not predict denomination
            authenticity=authenticity,
            confidence=confidence_fraction,
            features_checked=_FEATURES,
            message=message,
        )

    except Exception as e:
        logger.exception("Error during counterfeit currency check inference")
        return CurrencyCheckResponse(
            denomination=None,
            authenticity="uncertain",
            confidence=0.0,
            features_checked=[],
            message=f"Model analysis failed: {str(e)}. Please retry with a clearer photo in good lighting.",
        )
