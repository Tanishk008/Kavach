"""Classification events — every classifier verdict, feeding dashboard/map/graph."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    channel: Mapped[str] = mapped_column(String(16), default="app")  # app|whatsapp|ivr
    input_type: Mapped[str] = mapped_column(String(16), nullable=False)  # text|image|voice|number|payment
    content_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    tier: Mapped[str] = mapped_column(String(16), nullable=False)  # safe|caution|high_risk
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    scam_type: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    reasons: Mapped[list | None] = mapped_column(JSON, nullable=True)
    matched_playbook_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    region_city: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    region_pin: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

