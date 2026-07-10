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

# ── Intelligence pipeline routers ──────────────────────────────────────────
app.include_router(intelligence_router.router)


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
