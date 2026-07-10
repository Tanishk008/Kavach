"""Thin wrapper around the Neo4j driver (fraud network graph, B.5).

Fails soft: if Neo4j is unreachable the app still serves the relational APIs, and
graph writes become no-ops with a logged warning. This keeps the demo resilient.
"""
import logging

from neo4j import Driver, GraphDatabase

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_driver: Driver | None = None


def get_driver() -> Driver | None:
    global _driver
    if _driver is None:
        try:
            _driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
            )
            _driver.verify_connectivity()
        except Exception as exc:  # noqa: BLE001 - fail soft for resilience
            logger.warning("Neo4j unavailable, graph features disabled: %s", exc)
            _driver = None
    return _driver


def close_driver() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
