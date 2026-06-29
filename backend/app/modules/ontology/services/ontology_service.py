"""Application services for the ontology module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

from app.modules.applications.repositories.interfaces import ApplicationRepository
from app.modules.ontology.domain.enums import OntologyDefinitionStatus
from app.modules.ontology.domain.models import OntologyDefinition
from app.modules.ontology.ports.interfaces import TraceRecorder
from app.modules.ontology.repositories.interfaces import OntologyDefinitionRepository

UNSET = object()

DEFAULT_ONTOLOGY_DEFINITION: dict[str, Any] = {
    "schema_version": "1",
    "classes": [],
    "properties": [],
    "relationships": [],
    "metadata": {},
}


class ApplicationNotFoundError(Exception):
    """Raised when the parent application does not exist."""


class OntologyDefinitionNotFoundError(Exception):
    """Raised when an ontology definition cannot be found."""


class ImmutableOntologyDefinitionError(Exception):
    """Raised when mutating a locked ontology definition."""


class InvalidOntologyDefinitionStatusTransitionError(Exception):
    """Raised when an ontology status transition is not allowed."""


class InvalidOntologyDefinitionVersionForkError(Exception):
    """Raised when an ontology version fork is not allowed."""


class _NoOpTraceRecorder:
    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        return None


class OntologyService:
    """Ontology definition CRUD and lifecycle orchestration."""

    def __init__(
        self,
        repository: OntologyDefinitionRepository,
        application_repository: ApplicationRepository,
        trace_recorder: TraceRecorder | None = None,
    ) -> None:
        self._repository = repository
        self._application_repository = application_repository
        self._trace_recorder = trace_recorder or _NoOpTraceRecorder()

    def create_ontology(
        self,
        *,
        application_id: UUID,
        title: str,
        created_by: str | None = None,
        description: str | None = None,
        ontology_definition: dict[str, Any] | None = None,
    ) -> OntologyDefinition:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")

        now = datetime.now(UTC)
        if ontology_definition is None:
            definition = dict(DEFAULT_ONTOLOGY_DEFINITION)
        else:
            definition = ontology_definition
        ontology = OntologyDefinition(
            id=uuid4(),
            application_id=application_id,
            version_number=1,
            status=OntologyDefinitionStatus.DRAFT,
            title=title,
            description=description,
            created_by=created_by or "",
            created_at=now,
            updated_at=now,
            ontology_definition=definition,
        )
        created = self._repository.create(ontology)
        self._trace_recorder.record_transaction(
            transaction_type="ontology.created",
            resource_type="OntologyDefinition",
            resource_id=str(created.id),
        )
        return created

    def list_ontologies(
        self,
        *,
        application_id: UUID,
        status: OntologyDefinitionStatus | None = None,
    ) -> list[OntologyDefinition]:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")
        status_value = status.value if status is not None else None
        return list(self._repository.list_by_application(application_id, status=status_value))

    def get_ontology(self, ontology_id: UUID) -> OntologyDefinition:
        ontology = self._repository.get(ontology_id)
        if ontology is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        return ontology

    def update_ontology(
        self,
        ontology_id: UUID,
        *,
        title: str | None = None,
        description: str | None | object = UNSET,
        ontology_definition: dict[str, Any] | None | object = UNSET,
    ) -> OntologyDefinition:
        current = self._repository.get(ontology_id)
        if current is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        if current.status in {
            OntologyDefinitionStatus.VERSIONED,
            OntologyDefinitionStatus.RETIRED,
        }:
            raise ImmutableOntologyDefinitionError(
                "Ontology definition is immutable in current status"
            )

        updated = OntologyDefinition(
            id=current.id,
            application_id=current.application_id,
            version_number=current.version_number,
            previous_version_id=current.previous_version_id,
            status=current.status,
            title=title if title is not None else current.title,
            description=(
                current.description if description is UNSET else cast(str | None, description)
            ),
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            validated_at=current.validated_at,
            approved_at=current.approved_at,
            published_at=current.published_at,
            version_created_at=current.version_created_at,
            ontology_definition=(
                current.ontology_definition
                if ontology_definition is UNSET
                else cast(dict[str, Any], ontology_definition)
            ),
        )
        result = self._repository.update(updated)
        if result is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        return result

    def update_status(
        self, ontology_id: UUID, *, status: OntologyDefinitionStatus
    ) -> OntologyDefinition:
        current = self._repository.get(ontology_id)
        if current is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        if not _is_valid_status_transition(current.status, status):
            raise InvalidOntologyDefinitionStatusTransitionError(
                f"Invalid status transition: {current.status.value} -> {status.value}"
            )

        validated_at = current.validated_at
        if status == OntologyDefinitionStatus.VALIDATED and validated_at is None:
            validated_at = datetime.now(UTC)

        approved_at = current.approved_at
        if status == OntologyDefinitionStatus.APPROVED and approved_at is None:
            approved_at = datetime.now(UTC)

        published_at = current.published_at
        if status == OntologyDefinitionStatus.PUBLISHED and published_at is None:
            published_at = datetime.now(UTC)

        updated = OntologyDefinition(
            id=current.id,
            application_id=current.application_id,
            version_number=current.version_number,
            previous_version_id=current.previous_version_id,
            status=status,
            title=current.title,
            description=current.description,
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            validated_at=validated_at,
            approved_at=approved_at,
            published_at=published_at,
            version_created_at=current.version_created_at,
            ontology_definition=current.ontology_definition,
        )
        result = self._repository.update(updated)
        if result is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        return result

    def create_version(
        self,
        ontology_id: UUID,
        *,
        ontology_definition: dict[str, Any] | None = None,
    ) -> OntologyDefinition:
        parent = self._repository.get(ontology_id)
        if parent is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        if parent.status not in {
            OntologyDefinitionStatus.PUBLISHED,
            OntologyDefinitionStatus.VERSIONED,
        }:
            raise InvalidOntologyDefinitionVersionForkError(
                "Version fork requires parent status Published or Versioned"
            )

        definition = (
            dict(parent.ontology_definition)
            if ontology_definition is None
            else ontology_definition
        )

        now = datetime.now(UTC)
        child = OntologyDefinition(
            id=uuid4(),
            application_id=parent.application_id,
            version_number=parent.version_number + 1,
            previous_version_id=parent.id,
            status=OntologyDefinitionStatus.DRAFT,
            title=parent.title,
            description=parent.description,
            created_by=parent.created_by,
            created_at=now,
            updated_at=now,
            version_created_at=now,
            ontology_definition=definition,
        )
        return self._repository.create(child)


VALID_STATUS_TRANSITIONS: dict[
    OntologyDefinitionStatus, set[OntologyDefinitionStatus]
] = {
    OntologyDefinitionStatus.DRAFT: {OntologyDefinitionStatus.VALIDATED},
    OntologyDefinitionStatus.VALIDATED: {
        OntologyDefinitionStatus.APPROVED,
        OntologyDefinitionStatus.DRAFT,
    },
    OntologyDefinitionStatus.APPROVED: {OntologyDefinitionStatus.PUBLISHED},
    OntologyDefinitionStatus.PUBLISHED: {OntologyDefinitionStatus.VERSIONED},
    OntologyDefinitionStatus.VERSIONED: {OntologyDefinitionStatus.RETIRED},
    OntologyDefinitionStatus.RETIRED: set(),
}


def _is_valid_status_transition(
    current: OntologyDefinitionStatus, target: OntologyDefinitionStatus
) -> bool:
    return target in VALID_STATUS_TRANSITIONS[current]
