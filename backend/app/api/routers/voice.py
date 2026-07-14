"""Voice analysis router — AI vs. Human voice deepfake detection.

POST /api/voice/analyze
  Accepts a multipart audio file upload (wav, mp3, ogg, m4a, webm).

  Analysis uses librosa for signal-processing based deepfake detection:
    - MFCC variance      (AI TTS is unnaturally uniform)
    - Spectral centroid  (monotone TTS stays in a narrow band)
    - RMS energy std     (AI has flat loudness; humans vary)
    - Zero-crossing rate (TTS is unnaturally smooth)
    - Spectral rolloff   (fast proxy — no heavy pitch tracking)

  NOTE: We deliberately avoid librosa.pyin() (pitch tracking) because
  numba JIT-compiles on first invocation and takes 15-30 s cold-start.
  The remaining features are lightweight and give good discrimination.

  All heavy work runs in a thread-pool executor so it never blocks
  the FastAPI event loop.

  Returns: verdict (human | ai_generated | uncertain), confidence,
           signals, advice, duration_seconds.
"""
from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from typing import Literal

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {
    "audio/wav", "audio/wave", "audio/x-wav",
    "audio/mpeg", "audio/mp3",
    "audio/ogg", "audio/vorbis",
    "audio/mp4", "audio/m4a", "audio/x-m4a",
    "audio/webm",
    "application/octet-stream",  # browsers sometimes send this for Blobs
}
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".ogg", ".m4a", ".webm", ".opus"}

# Single shared thread-pool for audio analysis (CPU-bound but not parallelised)
_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="voice_analysis")


class VoiceAnalysisResponse(BaseModel):
    verdict: Literal["human", "ai_generated", "uncertain"]
    confidence: float  # 0.0–1.0
    signals: list[str]
    advice: str
    duration_seconds: float | None = None
    processing_note: str | None = None


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL ANALYSIS (runs in thread pool, must not be async)
# ─────────────────────────────────────────────────────────────────────────────

def _analyse_audio_sync(path: str) -> VoiceAnalysisResponse:
    """CPU-bound librosa analysis. Runs in a thread pool, not on the event loop."""
    try:
        import librosa          # noqa: PLC0415  (imported here to keep startup fast)
        import numpy as np
    except ImportError:
        logger.warning("librosa not installed in current env — returning uncertain verdict")
        return VoiceAnalysisResponse(
            verdict="uncertain",
            confidence=0.40,
            signals=["Audio analysis library unavailable on this server"],
            advice=(
                "Could not run deep audio analysis. "
                "Be cautious with any voice note requesting money, OTPs, or personal details."
            ),
            processing_note="librosa not installed",
        )

    # ── Load audio ───────────────────────────────────────────────────────────
    try:
        y, sr = librosa.load(path, sr=16000, mono=True, duration=60.0)
    except Exception as exc:
        logger.warning("Could not decode audio file: %s", exc)
        return VoiceAnalysisResponse(
            verdict="uncertain",
            confidence=0.35,
            signals=["Could not decode this audio file"],
            advice="Could not read the audio. Try WAV or OGG format for best compatibility.",
        )

    duration = librosa.get_duration(y=y, sr=sr)

    if duration < 1.5:
        return VoiceAnalysisResponse(
            verdict="uncertain",
            confidence=0.30,
            signals=["Voice note too short for reliable analysis (< 1.5 s)"],
            advice=(
                "The clip is too short to analyse. "
                "Be cautious with any voice message asking for money or OTPs."
            ),
            duration_seconds=round(duration, 2),
        )

    signals: list[str] = []
    ai_score = 0.0
    weight_total = 0.0

    # ── Feature 1: MFCC temporal variance ────────────────────────────────────
    # Human speech: high MFCC variance (rapid vocal-tract changes).
    # AI/TTS:       low MFCC variance (formulaic, uniform synthesis).
    try:
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        # Variance across time for each coefficient, then mean
        mfcc_var = float(np.mean(np.var(mfccs, axis=1)))

        if mfcc_var < 50:
            ai_score += 1.0
            signals.append(
                f" Unusually uniform vocal fingerprint — MFCC variance {mfcc_var:.1f} "
                "(AI-generated voices cluster far below human speech levels)"
            )
        elif mfcc_var < 120:
            ai_score += 0.55
            signals.append(
                f" Moderately uniform vocal tone — MFCC variance {mfcc_var:.1f} "
                "(below typical human range, possibly synthetic)"
            )
        else:
            signals.append(
                f" Rich vocal variation — MFCC variance {mfcc_var:.1f} "
                "(consistent with natural human speech)"
            )
        weight_total += 1.0
    except Exception as e:
        logger.debug("MFCC analysis failed: %s", e)

    # ── Feature 2: Spectral centroid stability ────────────────────────────────
    # Human speech: centroid wanders widely as vowels, consonants alternate.
    # TTS:          centroid stays in a narrow, artificial range.
    try:
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        centroid_std = float(np.std(centroid))
        centroid_mean = float(np.mean(centroid))
        cv = centroid_std / (centroid_mean + 1e-6)   # coefficient of variation

        if cv < 0.15:
            ai_score += 0.75
            signals.append(
                f" Narrow spectral range (CV={cv:.2f}) — tonal variety is unnaturally restricted"
            )
        elif cv < 0.30:
            ai_score += 0.30
            signals.append(
                f" Limited spectral range (CV={cv:.2f}) — somewhat restricted tonal variation"
            )
        else:
            signals.append(
                f" Wide spectral range (CV={cv:.2f}) — natural tonal diversity detected"
            )
        weight_total += 0.75
    except Exception as e:
        logger.debug("Spectral centroid analysis failed: %s", e)

    # ── Feature 3: RMS energy dynamics ───────────────────────────────────────
    # Human speech: loudness varies naturally (emphasis, pauses, breaths).
    # TTS:          loudness often overly uniform (no genuine dynamics).
    try:
        rms = librosa.feature.rms(y=y)[0]
        rms_std = float(np.std(rms))
        rms_mean = float(np.mean(rms))
        rms_cv = rms_std / (rms_mean + 1e-6)

        if rms_cv < 0.25:
            ai_score += 0.65
            signals.append(
                f" Flat loudness profile (energy CV={rms_cv:.2f}) — "
                "AI voices lack the natural stress and rhythm of human speech"
            )
        elif rms_cv < 0.55:
            ai_score += 0.20
            signals.append(
                f" Somewhat uniform loudness (energy CV={rms_cv:.2f})"
            )
        else:
            signals.append(
                f" Dynamic energy envelope (energy CV={rms_cv:.2f}) — "
                "natural stress and rhythm patterns detected"
            )
        weight_total += 0.65
    except Exception as e:
        logger.debug("RMS energy analysis failed: %s", e)

    # ── Feature 4: Zero-crossing rate variance ────────────────────────────────
    # Human fricatives (s, f, sh) and plosives (p, t, k) create sharp ZCR spikes.
    # TTS often has unnaturally smooth ZCR without these transitions.
    try:
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        zcr_std = float(np.std(zcr))

        if zcr_std < 0.03:
            ai_score += 0.60
            signals.append(
                f" Smooth articulation pattern (ZCR std={zcr_std:.3f}) — "
                "lacks the sharp consonant transitions of natural speech"
            )
        elif zcr_std < 0.07:
            ai_score += 0.20
            signals.append(
                f" Slightly smooth articulation (ZCR std={zcr_std:.3f})"
            )
        else:
            signals.append(
                f" Natural consonant dynamics (ZCR std={zcr_std:.3f}) — "
                "plosive and fricative transitions detected"
            )
        weight_total += 0.60
    except Exception as e:
        logger.debug("ZCR analysis failed: %s", e)

    # ── Feature 5: Spectral rolloff stability ─────────────────────────────────
    # Human speech: rolloff varies between voiced and unvoiced segments.
    # TTS: rolloff tends to be more stable and predictable.
    try:
        rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        rolloff_cv = float(np.std(rolloff) / (np.mean(rolloff) + 1e-6))

        if rolloff_cv < 0.12:
            ai_score += 0.50
            signals.append(
                f" Uniform high-frequency energy distribution (rolloff CV={rolloff_cv:.2f})"
            )
        elif rolloff_cv < 0.25:
            ai_score += 0.15
        else:
            signals.append(
                f" Varied high-frequency transitions (rolloff CV={rolloff_cv:.2f}) — "
                "typical of natural voiced/unvoiced alternation"
            )
        weight_total += 0.50
    except Exception as e:
        logger.debug("Spectral rolloff analysis failed: %s", e)

    # ── Feature 6: Silence/pause ratio ───────────────────────────────────────
    # Human speech has natural pauses; TTS can be too continuous OR too clipped.
    try:
        # Count frames below 2% of max RMS as "silence"
        rms_vals = librosa.feature.rms(y=y)[0]
        silence_ratio = float(np.mean(rms_vals < 0.02 * np.max(rms_vals)))

        if silence_ratio < 0.05:
            ai_score += 0.40
            signals.append(
                " Almost no natural pauses (silence ratio < 5%) — "
                "TTS voices often fill every gap artificially"
            )
        elif silence_ratio > 0.60:
            signals.append(
                " Very high silence ratio — recording quality may be poor"
            )
        else:
            signals.append(
                f" Natural pause structure ({silence_ratio:.0%} silence) — "
                "breathing gaps and micro-pauses detected"
            )
        weight_total += 0.40
    except Exception as e:
        logger.debug("Silence ratio analysis failed: %s", e)

    # ── Compute final verdict ─────────────────────────────────────────────────
    if weight_total == 0:
        # All features failed — return uncertain
        return VoiceAnalysisResponse(
            verdict="uncertain",
            confidence=0.35,
            signals=["Could not extract audio features from this file"],
            advice="Could not analyse this audio. Be cautious — never share OTPs or send money based on a voice note.",
            duration_seconds=round(duration, 2),
        )

    normalised = ai_score / weight_total   # 0 = very human, 1 = very AI

    if normalised >= 0.58:
        verdict: Literal["human", "ai_generated", "uncertain"] = "ai_generated"
        confidence = round(min(0.95, 0.60 + normalised * 0.38), 2)
        advice = (
            " This voice note shows strong signs of AI synthesis. "
            "Scammers use AI voice cloning to impersonate police, bank officers, "
            "and even family members. "
            "Do NOT share OTPs, passwords, or send money based on this voice. "
            "Call the person back on a known number to verify."
        )
    elif normalised >= 0.35:
        verdict = "uncertain"
        confidence = round(min(0.80, 0.45 + normalised * 0.45), 2)
        advice = (
            "This voice has some unusual acoustic characteristics — "
            "we cannot confirm it is genuine human speech. "
            "Never share OTPs, account details, or send money based on a voice note alone. "
            "Always verify with a known, trusted contact method."
        )
    else:
        verdict = "human"
        confidence = round(min(0.92, 0.72 + (0.35 - normalised) * 0.55), 2)
        advice = (
            " This voice note shows natural human speech characteristics. "
            "Even so, always verify the caller's identity independently "
            "before sharing any sensitive information or transferring money."
        )

    if not signals:
        signals.append("Audio analysis completed")

    return VoiceAnalysisResponse(
        verdict=verdict,
        confidence=confidence,
        signals=signals,
        advice=advice,
        duration_seconds=round(duration, 2),
        processing_note="local acoustic detector v1",
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=VoiceAnalysisResponse)
async def analyze_voice(audio: UploadFile = File(...)) -> VoiceAnalysisResponse:
    """Analyse an audio file for AI/TTS synthesis (deepfake voice detection).

    Accepts: wav, mp3, ogg, m4a, webm (max 10 MB).
    Returns: verdict (human / ai_generated / uncertain), confidence, signals, advice.
    """
    content_type = (audio.content_type or "").lower()
    filename = audio.filename or "audio"
    ext = os.path.splitext(filename)[1].lower()

    # Permissive content-type check — browsers are inconsistent
    if content_type not in ALLOWED_CONTENT_TYPES and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Supported: wav, mp3, ogg, m4a, webm.",
        )

    data = await audio.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large (max 10 MB).")

    if len(data) < 100:
        raise HTTPException(status_code=400, detail="Audio file is empty or too small.")

    # Write to temp file (librosa needs a seekable file path)
    suffix = ext if ext in ALLOWED_EXTENSIONS else ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        # Run CPU-bound analysis in thread pool — never block the event loop
        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(_EXECUTOR, _analyse_audio_sync, tmp_path),
            timeout=45.0,   # 45 s hard limit; first call may trigger numba JIT
        )
        return result
    except asyncio.TimeoutError:
        logger.error("Voice analysis timed out for file: %s", filename)
        return VoiceAnalysisResponse(
            verdict="uncertain",
            confidence=0.35,
            signals=["Analysis timed out — audio may be too complex or server is busy"],
            advice=(
                "Analysis took too long. Try a shorter clip (< 30 s) or a WAV file. "
                "Be cautious with any voice note requesting money or personal information."
            ),
            processing_note="timeout",
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
