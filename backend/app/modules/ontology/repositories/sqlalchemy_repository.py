"""SQLAlchemy repository implementations for the ontology module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.ontology.domain.enums import OntologyDefinitionStatus
from app.modules.ontology.domain.models import OntologyDefinition
from app.modules.ontology.repositories.interfaces import OntologyDefinitionRepository
from app.modules.ontology.repositories.orm_models import (
    OntologyDefinition as OntologyDefinitionORM,
)


def _to_domain(ontology_orm: OntologyDefinitionORM) -> OntologyDefinition:
    return OntologyDefinition(
        id=ontology_orm.id,
        application_id=ontology_orm.application_id,
        version_number=ontology_orm.version_number,
        previous_version_id=ontology_orm.previous_version_id,
        status=OntologyDefinitionStatus(ontology_orm.status),
        title=ontology_orm.title,
        description=ontology_orm.description,
        created_by=ontology_orm.created_by,
        created_at=ontology_orm.created_at,
        updated_at=ontology_orm.updated_at,
        validated_at=ontology_orm.validated_at,
        approved_at=ontology_orm.approved_at,
        published_at=ontology_orm.published_at,
        version_created_at=ontology_orm.version_created_at,
        ontology_definition=ontology_orm.ontology_definition or {},
        connector_id=ontology_orm.connector_id,
        artifact_uri=ontology_orm.artifact_uri,
        source_format=ontology_orm.source_format,
    )


class SqlAlchemyOntologyDefinitionRepository(OntologyDefinitionRepository):
    """SQLAlchemy-backed implementation for ontology persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, ontology: OntologyDefinition) -> OntologyDefinition:
        ontology_orm = OntologyDefinitionORM(
            id=ontology.id,
            application_id=ontology.application_id,
            version_number=ontology.version_number,
            previous_version_id=ontology.previous_version_id,
            status=ontology.status.value,
            title=ontology.title,
            description=ontology.description,
            created_by=ontology.created_by,
            created_at=ontology.created_at,
            updated_at=ontology.updated_at,
            validated_at=ontology.validated_at,
            approved_at=ontology.approved_at,
            published_at=ontology.published_at,
            version_created_at=ontology.version_created_at,
            ontology_definition=ontology.ontology_definition,
            connector_id=ontology.connector_id,
            artifact_uri=ontology.artifact_uri,
            source_format=ontology.source_format,
        )
        self._session.add(ontology_orm)
        self._session.commit()
        self._session.refresh(ontology_orm)
        return _to_domain(ontology_orm)

    def list_by_application(
        self,
        application_id: UUID,
        *,
        status: str | None = None,
    ) -> Sequence[OntologyDefinition]:
        statement = (
            select(OntologyDefinitionORM)
            .where(OntologyDefinitionORM.application_id == application_id)
            .order_by(OntologyDefinitionORM.version_number.desc())
        )
        if status is not None:
            statement = statement.where(OntologyDefinitionORM.status == status)
        return [_to_domain(item) for item in self._session.scalars(statement).all()]

    def get(self, ontology_id: UUID) -> OntologyDefinition | None:
        ontology_orm = self._session.get(OntologyDefinitionORM, ontology_id)
        return _to_domain(ontology_orm) if ontology_orm else None

    def update(self, ontology: OntologyDefinition) -> OntologyDefinition | None:
        ontology_orm = self._session.get(OntologyDefinitionORM, ontology.id)
        if ontology_orm is None:
            return None

        ontology_orm.status = ontology.status.value
        ontology_orm.title = ontology.title
        ontology_orm.description = ontology.description
        ontology_orm.updated_at = ontology.updated_at
        ontology_orm.validated_at = ontology.validated_at
        ontology_orm.approved_at = ontology.approved_at
        ontology_orm.published_at = ontology.published_at
        ontology_orm.version_created_at = ontology.version_created_at
        ontology_orm.ontology_definition = ontology.ontology_definition
        ontology_orm.connector_id = ontology.connector_id
        ontology_orm.artifact_uri = ontology.artifact_uri
        ontology_orm.source_format = ontology.source_format

        self._session.commit()
        self._session.refresh(ontology_orm)
        return _to_domain(ontology_orm)

    def delete(self, ontology_id: UUID) -> bool:
        ontology_orm = self._session.get(OntologyDefinitionORM, ontology_id)
        if ontology_orm is None:
            return False
        self._session.delete(ontology_orm)
        self._session.commit()
        return True
