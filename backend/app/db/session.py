"""SQLAlchemy engine, session factory, and Base metadata (SQLite or PostgreSQL)."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

# SQLite needs check_same_thread=False; ignored by Postgres.
connect_args = {"check_same_thread": False} if settings.use_sqlite else {}

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Declarative base shared by all ORM models (and Alembic autogenerate)."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a request-scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    """Create all tables. Called on startup — no-op if tables already exist."""
    # Import all models so Base.metadata knows about them before create_all.
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
