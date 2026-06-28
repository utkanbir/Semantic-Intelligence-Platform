"""SQLAlchemy ORM models for the discovery module."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.infrastructure.database import metadata


class Base(DeclarativeBase):
    """Module-local declarative base bound to shared backend metadata."""

    metadata = metadata


class DiscoverySession(Base):
    """Discovery session aggregate root (DM-004)."""

    __tablename__ = "discovery_sessions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    application_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Active")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    started_by: Mapped[str] = mapped_column(String(255), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    intent_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    discovery_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    generated_blueprint_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), nullable=True
    )
    conversation_history: Mapped[list | None] = mapped_column(JSON, nullable=True)

    phase_history: Mapped[list[DiscoveryPhaseHistory]] = relationship(
        back_populates="session",
        order_by="DiscoveryPhaseHistory.entered_at",
        cascade="all, delete-orphan",
    )


class DiscoveryPhaseHistory(Base):
    """Append-only phase history entry (R-007)."""

    __tablename__ = "discovery_phase_history"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("discovery_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    phase_number: Mapped[int] = mapped_column(Integer, nullable=False)
    phase_name: Mapped[str] = mapped_column(String(255), nullable=False)
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    session: Mapped[DiscoverySession] = relationship(back_populates="phase_history")
