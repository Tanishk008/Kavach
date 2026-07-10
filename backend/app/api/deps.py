"""Shared FastAPI dependencies.

`get_db` (the request-scoped DB session) is re-exported here so routers have one
import site for dependencies. Auth/session dependencies will be added here.
"""
from app.db.session import get_db

__all__ = ["get_db"]

# TODO: add get_current_user() once real session tokens (JWT) are issued in auth.py.
