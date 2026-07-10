"""SQLAlchemy ORM models — mirror of database/postgres/schema.sql."""
from app.models.case import Case
from app.models.currency_check import CurrencyCheck
from app.models.event import Event
from app.models.report import CommunityReport, VerifiedNumber
from app.models.user import EmergencyContact, OtpCode, User

# Intelligence pipeline models
from app.models.intelligence import (
    CrimeEvent,
    GeocodeCache,
    Hotspot,
    ProcessedArticle,
    RawArticle,
    SchedulerLog,
    SourceLog,
)

__all__ = [
    # Existing models
    "User",
    "EmergencyContact",
    "OtpCode",
    "VerifiedNumber",
    "CommunityReport",
    "Event",
    "Case",
    "CurrencyCheck",
    # Intelligence pipeline models
    "RawArticle",
    "ProcessedArticle",
    "CrimeEvent",
    "Hotspot",
    "SchedulerLog",
    "SourceLog",
    "GeocodeCache",
]
