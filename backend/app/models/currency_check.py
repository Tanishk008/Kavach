"""Counterfeit currency check results."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class CurrencyCheck(Base):
    __tablename__ = "currency_checks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    denomination: Mapped[str | None] = mapped_column(String(8), nullable=True)
    authenticity: Mapped[str | None] = mapped_column(String(16), nullable=True)  # real|fake|uncertain
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    features_checked: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

