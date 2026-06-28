"""SQLAlchemy ORM models for the applications module."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.infrastructure.database import metadata


class Base(DeclarativeBase):
    """Module-local declarative base bound to shared backend metadata."""

    metadata = metadata


class Application(Base):
    """Application aggregate root (DM-001)."""

    __tablename__ = "applications"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    workspace: Mapped[ApplicationWorkspace] = relationship(
        back_populates="application",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ApplicationWorkspace(Base):
    """Per-application namespace workspace (DM-002, ARR-001)."""

    __tablename__ = "application_workspaces"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    application_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="provisioned")

    postgres_schema: Mapped[str] = mapped_column(String(255), nullable=False)
    minio_namespace: Mapped[str] = mapped_column(String(255), nullable=False)
    fuseki_dataset: Mapped[str] = mapped_column(String(255), nullable=False)
    qdrant_collection: Mapped[str] = mapped_column(String(255), nullable=False)
    metadata_domain: Mapped[str] = mapped_column(String(255), nullable=False)
    ontology_namespace: Mapped[str] = mapped_column(String(255), nullable=False)
    agent_namespace: Mapped[str] = mapped_column(String(255), nullable=False)
    product_registry_namespace: Mapped[str] = mapped_column(String(255), nullable=False)
    agent_registry_namespace: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    application: Mapped[Application] = relationship(back_populates="workspace")
