"""Kavach FastAPI application entry point.

Registers every domain router against one shared backend so the app, WhatsApp bot,
IVR, and intelligence pipeline all reach the same classifier core.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db.neo4j_client import close_driver
from app.db.session import create_tables
from app.api.routers import (
    auth,
    currency,
    evidence,
    graph,
    hotspot,
    messages,
    numbers,
    ocr,
    voice,
    bot,
    users,
    feed,
    whatsapp,
)
from app.api.routers import intelligence as intelligence_router
from app.intelligence.scheduler import (
    run_pipeline,
    start_scheduler,
    stop_scheduler,
)

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all DB tables (including intelligence tables) on startup
    create_tables()
    logger.info("[startup] Database tables ensured.")

    # Start the background intelligence pipeline scheduler
    try:
        start_scheduler()
        logger.info("[startup] Intelligence pipeline scheduler started.")
    except Exception as exc:
        logger.error("[startup] Scheduler failed to start: %s", exc)

    # Optionally run the pipeline immediately on first startup
    if settings.run_pipeline_on_startup:
        import asyncio
        import concurrent.futures
        loop = asyncio.get_event_loop()
        logger.info("[startup] Running initial pipeline pass...")
        loop.run_in_executor(None, run_pipeline)

    # Warm up librosa / numba in background so the first voice analysis is fast
    import asyncio as _asyncio
    def _warmup_librosa():
        try:
            import librosa as _librosa
            import numpy as _np
            # Load a tiny 0.1-second silent buffer through the most-used feature calls
            _y = _np.zeros(1600, dtype=_np.float32)   # 0.1 s at 16 kHz
            _librosa.feature.mfcc(y=_y, sr=16000, n_mfcc=20)
            _librosa.feature.spectral_centroid(y=_y, sr=16000)
            _librosa.feature.rms(y=_y)
            _librosa.feature.zero_crossing_rate(_y)
            logger.info("[startup] librosa warmup complete.")
        except Exception as exc:
            logger.warning("[startup] librosa warmup skipped: %s", exc)
    loop = _asyncio.get_event_loop()
    loop.run_in_executor(None, _warmup_librosa)

    yield

    # Cleanup
    stop_scheduler()
    close_driver()
    logger.info("[shutdown] Scheduler stopped, Neo4j driver closed.")


app = FastAPI(
    title="Kavach API",
    description=(
        "AI shield against digital fraud — classifier core, intelligence layer, "
        "and live cybercrime hotspot map."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Existing domain routers ────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(messages.router)
app.include_router(numbers.router)
app.include_router(currency.router)
app.include_router(evidence.router)
app.include_router(hotspot.router)
app.include_router(graph.router)
app.include_router(voice.router)
app.include_router(ocr.router)
app.include_router(bot.router)
app.include_router(users.router)
app.include_router(feed.router)

# ── Intelligence pipeline routers ──────────────────────────────────────────
app.include_router(intelligence_router.router)

# ── WhatsApp Bot ────────────────────────────────────────────────────────────
app.include_router(whatsapp.router)


@app.get("/", tags=["system"])
def root() -> dict:
    return {
        "status": "ok",
        "service": "kavach-backend",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["system"])
def health() -> dict:
    from app.intelligence.scheduler import get_scheduler_status
    sched = get_scheduler_status()
    return {
        "status": "ok",
        "service": "kavach-backend",
        "version": "0.2.0",
        "classifier": "mock" if settings.use_mock_classifier else "llm",
        "pipeline_scheduler": "running" if sched["running"] else "stopped",
        "pipeline_last_run": sched["last_run_at"].isoformat() if sched["last_run_at"] else None,
    }
