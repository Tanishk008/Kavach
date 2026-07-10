"""Intelligence pipeline orchestrator and APScheduler scheduler.

The pipeline runs every N minutes (default 30) and executes 6 steps:
    Step 1 — Collect:     Fetch articles from GNews, NewsAPI, RSS feeds
    Step 2 — Extract:     AI-extract structured fields via Gemini
    Step 3 — Geocode:     Convert locations to lat/lng
    Step 4 — Deduplicate: Mark duplicate articles
    Step 5 — Risk Score:  Compute city hotspot scores
    Step 6 — Log:         Write run summary to scheduler_logs

All steps are logged to the scheduler_logs table.
A manual trigger endpoint is provided for testing.
"""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import SessionLocal
from app.intelligence.collectors import GNewsCollector, NewsAPICollector, RSSCollector
from app.intelligence.deduplicator import Deduplicator
from app.intelligence.extractor import GeminiExtractor
from app.intelligence.geocoder import Geocoder
from app.intelligence.risk_engine import RiskEngine
from app.models.intelligence import SchedulerLog

logger = logging.getLogger(__name__)

# Module-level scheduler singleton
_scheduler: BackgroundScheduler | None = None
_last_run_at: datetime | None = None
_last_run_status: str | None = None


@contextmanager
def _db_session():
    """Context manager providing a fresh DB session for background jobs."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _log_step(
    db: Session,
    run_id: str,
    step: str,
    status: str,
    processed: int = 0,
    failed: int = 0,
    duration: float | None = None,
    error: str | None = None,
    details: dict | None = None,
) -> None:
    """Persist a SchedulerLog record."""
    try:
        log = SchedulerLog(
            run_id=run_id,
            step=step,
            status=status,
            items_processed=processed,
            items_failed=failed,
            duration_seconds=duration,
            error_message=error,
            details=details,
        )
        db.add(log)
        db.commit()
    except Exception as exc:
        logger.error("[pipeline] Failed to write scheduler log: %s", exc)
        db.rollback()


def run_pipeline(run_id: str | None = None) -> dict:
    """Execute the full 6-step intelligence pipeline synchronously.

    Returns:
        Summary dict with per-step results.
    """
    global _last_run_at, _last_run_status

    run_id = run_id or str(uuid.uuid4())
    summary: dict = {"run_id": run_id, "steps": {}}
    logger.info("[pipeline] Starting run %s", run_id)

    with _db_session() as db:
        # ── Step 1: Collect ──────────────────────────────────────────────────
        t0 = time.time()
        _log_step(db, run_id, "collect", "started")
        total_new = 0
        try:
            collectors = [
                GNewsCollector(db, run_id),
                NewsAPICollector(db, run_id),
                RSSCollector(db, run_id),
            ]
            for collector in collectors:
                _, new, _ = collector.collect()
                total_new += new
            duration = round(time.time() - t0, 2)
            _log_step(db, run_id, "collect", "success", processed=total_new, duration=duration)
            summary["steps"]["collect"] = {"new_articles": total_new, "duration_s": duration}
            logger.info("[pipeline] Step 1 collect: %d new articles in %.1fs", total_new, duration)
        except Exception as exc:
            duration = round(time.time() - t0, 2)
            _log_step(db, run_id, "collect", "error", error=str(exc), duration=duration)
            summary["steps"]["collect"] = {"error": str(exc)}
            logger.exception("[pipeline] Step 1 collect failed: %s", exc)

        # ── Step 2: Extract ──────────────────────────────────────────────────
        t0 = time.time()
        _log_step(db, run_id, "extract", "started")
        try:
            extractor = GeminiExtractor(db)
            processed, errors = extractor.extract_pending(limit=50)
            duration = round(time.time() - t0, 2)
            _log_step(
                db, run_id, "extract", "success",
                processed=processed, failed=errors, duration=duration,
            )
            summary["steps"]["extract"] = {
                "processed": processed, "errors": errors, "duration_s": duration
            }
            logger.info(
                "[pipeline] Step 2 extract: %d processed, %d errors in %.1fs",
                processed, errors, duration,
            )
        except Exception as exc:
            duration = round(time.time() - t0, 2)
            _log_step(db, run_id, "extract", "error", error=str(exc), duration=duration)
            summary["steps"]["extract"] = {"error": str(exc)}
            logger.exception("[pipeline] Step 2 extract failed: %s", exc)

        # ── Step 3: Geocode ──────────────────────────────────────────────────
        t0 = time.time()
        _log_step(db, run_id, "geocode", "started")
        try:
            geocoder = Geocoder(db)
            geocoded, skipped = geocoder.geocode_pending(limit=100)
            duration = round(time.time() - t0, 2)
            _log_step(
                db, run_id, "geocode", "success",
                processed=geocoded, duration=duration,
                details={"skipped": skipped},
            )
            summary["steps"]["geocode"] = {
                "geocoded": geocoded, "skipped": skipped, "duration_s": duration
            }
            logger.info(
                "[pipeline] Step 3 geocode: %d geocoded, %d skipped in %.1fs",
                geocoded, skipped, duration,
            )
        except Exception as exc:
            duration = round(time.time() - t0, 2)
            _log_step(db, run_id, "geocode", "error", error=str(exc), duration=duration)
            summary["steps"]["geocode"] = {"error": str(exc)}
            logger.exception("[pipeline] Step 3 geocode failed: %s", exc)

        # ── Step 4: Deduplicate ──────────────────────────────────────────────
        t0 = time.time()
        _log_step(db, run_id, "deduplicate", "started")
        try:
            deduplicator = Deduplicator(db)
            duplicates = deduplicator.deduplicate()
            duration = round(time.time() - t0, 2)
            _log_step(
                db, run_id, "deduplicate", "success",
                processed=duplicates, duration=duration,
            )
            summary["steps"]["deduplicate"] = {
                "duplicates_marked": duplicates, "duration_s": duration
            }
            logger.info(
                "[pipeline] Step 4 deduplicate: %d duplicates in %.1fs",
                duplicates, duration,
            )
        except Exception as exc:
            duration = round(time.time() - t0, 2)
            _log_step(db, run_id, "deduplicate", "error", error=str(exc), duration=duration)
            summary["steps"]["deduplicate"] = {"error": str(exc)}
            logger.exception("[pipeline] Step 4 deduplicate failed: %s", exc)

        # ── Step 5: Risk Scoring ─────────────────────────────────────────────
        t0 = time.time()
        _log_step(db, run_id, "risk", "started")
        try:
            engine = RiskEngine(db)
            hotspots_updated = engine.compute_all()
            duration = round(time.time() - t0, 2)
            _log_step(
                db, run_id, "risk", "success",
                processed=hotspots_updated, duration=duration,
            )
            summary["steps"]["risk"] = {
                "hotspots_updated": hotspots_updated, "duration_s": duration
            }
            logger.info(
                "[pipeline] Step 5 risk: %d hotspots updated in %.1fs",
                hotspots_updated, duration,
            )
        except Exception as exc:
            duration = round(time.time() - t0, 2)
            _log_step(db, run_id, "risk", "error", error=str(exc), duration=duration)
            summary["steps"]["risk"] = {"error": str(exc)}
            logger.exception("[pipeline] Step 5 risk failed: %s", exc)

        # ── Step 6: Final log ────────────────────────────────────────────────
        _log_step(
            db, run_id, "api_refresh", "success",
            details={"summary": summary},
        )

    _last_run_at = datetime.now(timezone.utc)
    _last_run_status = "success" if all(
        "error" not in v for v in summary["steps"].values()
    ) else "partial_error"

    logger.info("[pipeline] Run %s complete. Status: %s", run_id, _last_run_status)
    return summary


def start_scheduler() -> None:
    """Start the APScheduler background scheduler."""
    global _scheduler
    settings = get_settings()

    if _scheduler and _scheduler.running:
        logger.info("[scheduler] Already running.")
        return

    _scheduler = BackgroundScheduler(timezone="UTC")
    interval_minutes = settings.pipeline_interval_minutes

    _scheduler.add_job(
        func=run_pipeline,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="intelligence_pipeline",
        name="Kavach Intelligence Pipeline",
        replace_existing=True,
        misfire_grace_time=300,  # 5 min grace for missed fires
    )

    _scheduler.start()
    logger.info(
        "[scheduler] Started — pipeline runs every %d minutes.", interval_minutes
    )


def stop_scheduler() -> None:
    """Gracefully stop the background scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[scheduler] Stopped.")


def get_scheduler_status() -> dict:
    """Return current scheduler state."""
    return {
        "running": bool(_scheduler and _scheduler.running),
        "last_run_at": _last_run_at,
        "last_run_status": _last_run_status,
    }
