"""SQLAlchemy repository implementations for the semantic_connectors module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.semantic_connectors.domain.enums import (
    SemanticConnectorStatus,
    SemanticConnectorType,
)
from app.modules.semantic_connectors.domain.models import SemanticConnector
from app.modules.semantic_connectors.repositories.interfaces import SemanticConnectorRepository
from app.modules.semantic_connectors.repositories.orm_models import (
    SemanticConnector as SemanticConnectorORM,
)


def _to_domain(connector_orm: SemanticConnectorORM) -> SemanticConnector:
    return SemanticConnector(
        id=connector_orm.id,
        connector_key=connector_orm.connector_key,
        connector_type=SemanticConnectorType(connector_orm.connector_type),
        status=SemanticConnectorStatus(connector_orm.status),
        title=connector_orm.title,
        description=connector_orm.description,
        technology_adapter_id=connector_orm.technology_adapter_id,
        created_by=connector_orm.created_by,
        created_at=connector_orm.created_at,
        updated_at=connector_orm.updated_at,
        connector_configuration=connector_orm.connector_configuration or {},
    )


class SqlAlchemySemanticConnectorRepository(SemanticConnectorRepository):
    """SQLAlchemy-backed implementation for semantic connector persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, connector: SemanticConnector) -> SemanticConnector:
        connector_orm = SemanticConnectorORM(
            id=connector.id,
            connector_key=connector.connector_key,
            connector_type=connector.connector_type.value,
            status=connector.status.value,
            title=connector.title,
            description=connector.description,
            technology_adapter_id=connector.technology_adapter_id,
            created_by=connector.created_by,
            created_at=connector.created_at,
            updated_at=connector.updated_at,
            connector_configuration=connector.connector_configuration,
        )
        self._session.add(connector_orm)
        self._session.commit()
        self._session.refresh(connector_orm)
        return _to_domain(connector_orm)

    def get(self, connector_id: UUID) -> SemanticConnector | None:
        connector_orm = self._session.get(SemanticConnectorORM, connector_id)
        return _to_domain(connector_orm) if connector_orm else None

    def get_by_key(self, connector_key: str) -> SemanticConnector | None:
        statement = select(SemanticConnectorORM).where(
            SemanticConnectorORM.connector_key == connector_key
        )
        connector_orm = self._session.scalars(statement).first()
        return _to_domain(connector_orm) if connector_orm else None

    def list_all(
        self,
        *,
        connector_type: SemanticConnectorType | None = None,
        active_only: bool = False,
    ) -> Sequence[SemanticConnector]:
        statement = select(SemanticConnectorORM).order_by(SemanticConnectorORM.title.asc())
        if connector_type is not None:
            statement = statement.where(
                SemanticConnectorORM.connector_type == connector_type.value
            )
        if active_only:
            statement = statement.where(
                SemanticConnectorORM.status == SemanticConnectorStatus.ACTIVE.value
            )
        return [_to_domain(item) for item in self._session.scalars(statement).all()]
