"""SQLAlchemy repository implementations for the knowledge_graph module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.knowledge_graph.domain.enums import KnowledgeGraphRegistryStatus
from app.modules.knowledge_graph.domain.models import KnowledgeGraphRegistry
from app.modules.knowledge_graph.repositories.interfaces import KnowledgeGraphRegistryRepository
from app.modules.knowledge_graph.repositories.orm_models import (
    KnowledgeGraphRegistry as KnowledgeGraphRegistryORM,
)


def _to_domain(registry_orm: KnowledgeGraphRegistryORM) -> KnowledgeGraphRegistry:
    return KnowledgeGraphRegistry(
        id=registry_orm.id,
        application_id=registry_orm.application_id,
        status=KnowledgeGraphRegistryStatus(registry_orm.status),
        title=registry_orm.title,
        description=registry_orm.description,
        created_by=registry_orm.created_by,
        created_at=registry_orm.created_at,
        updated_at=registry_orm.updated_at,
        populated_at=registry_orm.populated_at,
        graph_updated_at=registry_orm.graph_updated_at,
        archived_at=registry_orm.archived_at,
        graph_metadata=registry_orm.graph_metadata or {},
        bound_ontology_ids=list(registry_orm.bound_ontology_ids or []),
    )


class SqlAlchemyKnowledgeGraphRegistryRepository(KnowledgeGraphRegistryRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, registry: KnowledgeGraphRegistry) -> KnowledgeGraphRegistry:
        registry_orm = KnowledgeGraphRegistryORM(
            id=registry.id,
            application_id=registry.application_id,
            status=registry.status.value,
            title=registry.title,
            description=registry.description,
            created_by=registry.created_by,
            created_at=registry.created_at,
            updated_at=registry.updated_at,
            populated_at=registry.populated_at,
            graph_updated_at=registry.graph_updated_at,
            archived_at=registry.archived_at,
            graph_metadata=registry.graph_metadata,
            bound_ontology_ids=registry.bound_ontology_ids,
        )
        self._session.add(registry_orm)
        self._session.commit()
        self._session.refresh(registry_orm)
        return _to_domain(registry_orm)

    def list_by_application(
        self,
        application_id: UUID,
        *,
        status: str | None = None,
    ) -> Sequence[KnowledgeGraphRegistry]:
        statement = select(KnowledgeGraphRegistryORM).where(
            KnowledgeGraphRegistryORM.application_id == application_id
        )
        if status is not None:
            statement = statement.where(KnowledgeGraphRegistryORM.status == status)
        return [_to_domain(item) for item in self._session.scalars(statement).all()]

    def get(self, registry_id: UUID) -> KnowledgeGraphRegistry | None:
        registry_orm = self._session.get(KnowledgeGraphRegistryORM, registry_id)
        return _to_domain(registry_orm) if registry_orm else None

    def update(self, registry: KnowledgeGraphRegistry) -> KnowledgeGraphRegistry | None:
        registry_orm = self._session.get(KnowledgeGraphRegistryORM, registry.id)
        if registry_orm is None:
            return None
        registry_orm.status = registry.status.value
        registry_orm.title = registry.title
        registry_orm.description = registry.description
        registry_orm.updated_at = registry.updated_at
        registry_orm.populated_at = registry.populated_at
        registry_orm.graph_updated_at = registry.graph_updated_at
        registry_orm.archived_at = registry.archived_at
        registry_orm.graph_metadata = registry.graph_metadata
        registry_orm.bound_ontology_ids = registry.bound_ontology_ids
        self._session.commit()
        self._session.refresh(registry_orm)
        return _to_domain(registry_orm)
