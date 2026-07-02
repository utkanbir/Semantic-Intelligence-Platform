"""SQLAlchemy repository implementations for the adapters module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.adapters.domain.enums import TechnologyAdapterStatus, ConnectorType
from app.modules.adapters.domain.models import TechnologyAdapter
from app.modules.adapters.repositories.interfaces import TechnologyAdapterRepository
from app.modules.adapters.repositories.orm_models import (
    TechnologyAdapter as TechnologyAdapterORM,
)


def _to_domain(adapter_orm: TechnologyAdapterORM) -> TechnologyAdapter:
    return TechnologyAdapter(
        id=adapter_orm.id,
        technology_type=ConnectorType(adapter_orm.connector_type),
        adapter_key=adapter_orm.adapter_key,
        status=TechnologyAdapterStatus(adapter_orm.status),
        title=adapter_orm.title,
        description=adapter_orm.description,
        created_by=adapter_orm.created_by,
        created_at=adapter_orm.created_at,
        updated_at=adapter_orm.updated_at,
        configured_at=adapter_orm.configured_at,
        activated_at=adapter_orm.activated_at,
        deprecated_at=adapter_orm.deprecated_at,
        retired_at=adapter_orm.retired_at,
        adapter_configuration=adapter_orm.adapter_configuration or {},
    )


class SqlAlchemyTechnologyAdapterRepository(TechnologyAdapterRepository):
    """SQLAlchemy-backed implementation for technology adapter persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, adapter: TechnologyAdapter) -> TechnologyAdapter:
        adapter_orm = TechnologyAdapterORM(
            id=adapter.id,
            connector_type=adapter.technology_type.value,
            adapter_key=adapter.adapter_key,
            status=adapter.status.value,
            title=adapter.title,
            description=adapter.description,
            created_by=adapter.created_by,
            created_at=adapter.created_at,
            updated_at=adapter.updated_at,
            configured_at=adapter.configured_at,
            activated_at=adapter.activated_at,
            deprecated_at=adapter.deprecated_at,
            retired_at=adapter.retired_at,
            adapter_configuration=adapter.adapter_configuration,
        )
        self._session.add(adapter_orm)
        self._session.commit()
        self._session.refresh(adapter_orm)
        return _to_domain(adapter_orm)

    def list_all(
        self,
        *,
        connector_type: str | None = None,
        status: str | None = None,
    ) -> Sequence[TechnologyAdapter]:
        statement = select(TechnologyAdapterORM).order_by(
            TechnologyAdapterORM.created_at.desc()
        )
        if connector_type is not None:
            statement = statement.where(
                TechnologyAdapterORM.connector_type == connector_type
            )
        if status is not None:
            statement = statement.where(TechnologyAdapterORM.status == status)
        return [_to_domain(item) for item in self._session.scalars(statement).all()]

    def get(self, adapter_id: UUID) -> TechnologyAdapter | None:
        adapter_orm = self._session.get(TechnologyAdapterORM, adapter_id)
        return _to_domain(adapter_orm) if adapter_orm else None

    def get_by_key(self, adapter_key: str) -> TechnologyAdapter | None:
        statement = select(TechnologyAdapterORM).where(
            TechnologyAdapterORM.adapter_key == adapter_key
        )
        adapter_orm = self._session.scalars(statement).first()
        return _to_domain(adapter_orm) if adapter_orm else None

    def get_active_by_connector_type(
        self, connector_type: str
    ) -> TechnologyAdapter | None:
        statement = select(TechnologyAdapterORM).where(
            TechnologyAdapterORM.connector_type == connector_type,
            TechnologyAdapterORM.status == TechnologyAdapterStatus.ACTIVE.value,
        )
        adapter_orm = self._session.scalars(statement).first()
        return _to_domain(adapter_orm) if adapter_orm else None

    def update(self, adapter: TechnologyAdapter) -> TechnologyAdapter | None:
        adapter_orm = self._session.get(TechnologyAdapterORM, adapter.id)
        if adapter_orm is None:
            return None
        adapter_orm.connector_type = adapter.technology_type.value
        adapter_orm.adapter_key = adapter.adapter_key
        adapter_orm.status = adapter.status.value
        adapter_orm.title = adapter.title
        adapter_orm.description = adapter.description
        adapter_orm.updated_at = adapter.updated_at
        adapter_orm.configured_at = adapter.configured_at
        adapter_orm.activated_at = adapter.activated_at
        adapter_orm.deprecated_at = adapter.deprecated_at
        adapter_orm.retired_at = adapter.retired_at
        adapter_orm.adapter_configuration = adapter.adapter_configuration
        self._session.commit()
        self._session.refresh(adapter_orm)
        return _to_domain(adapter_orm)
