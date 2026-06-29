"""Application services for the knowledge_graph module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

from app.modules.applications.repositories.interfaces import ApplicationRepository
from app.modules.knowledge_graph.domain.enums import KnowledgeGraphRegistryStatus
from app.modules.knowledge_graph.domain.models import KnowledgeGraphRegistry
from app.modules.knowledge_graph.ports.interfaces import PublishedOntologyReader, TraceRecorder
from app.modules.knowledge_graph.repositories.interfaces import KnowledgeGraphRegistryRepository
from app.modules.ontology.domain.enums import OntologyDefinitionStatus

UNSET = object()

DEFAULT_GRAPH_METADATA: dict[str, Any] = {
    "schema_version": "1",
    "triple_count": 0,
    "namespaces": [],
    "metadata": {},
}

BINDABLE_ONTOLOGY_STATUSES = {
    OntologyDefinitionStatus.PUBLISHED.value,
    OntologyDefinitionStatus.VERSIONED.value,
}


class ApplicationNotFoundError(Exception):
    pass


class KnowledgeGraphRegistryNotFoundError(Exception):
    pass


class ImmutableKnowledgeGraphRegistryError(Exception):
    pass


class OntologyDefinitionNotFoundError(Exception):
    pass


class InvalidOntologyBindingError(Exception):
    pass


class InvalidKnowledgeGraphStatusTransitionError(Exception):
    pass


class _NoOpTraceRecorder:
    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        return None


class KnowledgeGraphService:
    def __init__(
        self,
        repository: KnowledgeGraphRegistryRepository,
        application_repository: ApplicationRepository,
        ontology_reader: PublishedOntologyReader,
        trace_recorder: TraceRecorder | None = None,
    ) -> None:
        self._repository = repository
        self._application_repository = application_repository
        self._ontology_reader = ontology_reader
        self._trace_recorder = trace_recorder or _NoOpTraceRecorder()

    def create_registry(
        self,
        *,
        application_id: UUID,
        title: str,
        created_by: str | None = None,
        description: str | None = None,
        graph_metadata: dict[str, Any] | None = None,
        bound_ontology_ids: list[str] | None = None,
    ) -> KnowledgeGraphRegistry:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")

        ontology_ids = bound_ontology_ids or []
        self._validate_bound_ontologies(application_id, ontology_ids)

        now = datetime.now(UTC)
        if graph_metadata is None:
            metadata = dict(DEFAULT_GRAPH_METADATA)
        else:
            metadata = graph_metadata
        registry = KnowledgeGraphRegistry(
            id=uuid4(),
            application_id=application_id,
            status=KnowledgeGraphRegistryStatus.CREATED,
            title=title,
            description=description,
            created_by=created_by or "",
            created_at=now,
            updated_at=now,
            graph_metadata=metadata,
            bound_ontology_ids=ontology_ids,
        )
        created = self._repository.create(registry)
        self._trace_recorder.record_transaction(
            transaction_type="knowledge_graph.created",
            resource_type="KnowledgeGraphRegistry",
            resource_id=str(created.id),
        )
        return created

    def list_registries(
        self,
        *,
        application_id: UUID,
        status: KnowledgeGraphRegistryStatus | None = None,
    ) -> list[KnowledgeGraphRegistry]:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")
        status_value = status.value if status is not None else None
        return list(self._repository.list_by_application(application_id, status=status_value))

    def get_registry(self, registry_id: UUID) -> KnowledgeGraphRegistry:
        registry = self._repository.get(registry_id)
        if registry is None:
            raise KnowledgeGraphRegistryNotFoundError("Knowledge graph registry not found")
        return registry

    def update_registry(
        self,
        registry_id: UUID,
        *,
        title: str | None = None,
        description: str | None | object = UNSET,
        graph_metadata: dict[str, Any] | None | object = UNSET,
        bound_ontology_ids: list[str] | None | object = UNSET,
    ) -> KnowledgeGraphRegistry:
        current = self._repository.get(registry_id)
        if current is None:
            raise KnowledgeGraphRegistryNotFoundError("Knowledge graph registry not found")
        if current.status == KnowledgeGraphRegistryStatus.ARCHIVED:
            raise ImmutableKnowledgeGraphRegistryError(
                "Knowledge graph registry is immutable in Archived status"
            )

        resolved_ontologies = (
            current.bound_ontology_ids
            if bound_ontology_ids is UNSET
            else cast(list[str], bound_ontology_ids)
        )
        self._validate_bound_ontologies(current.application_id, resolved_ontologies)

        updated = KnowledgeGraphRegistry(
            id=current.id,
            application_id=current.application_id,
            status=current.status,
            title=title if title is not None else current.title,
            description=(
                current.description if description is UNSET else cast(str | None, description)
            ),
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            populated_at=current.populated_at,
            graph_updated_at=current.graph_updated_at,
            archived_at=current.archived_at,
            graph_metadata=(
                current.graph_metadata
                if graph_metadata is UNSET
                else cast(dict[str, Any], graph_metadata)
            ),
            bound_ontology_ids=resolved_ontologies,
        )
        result = self._repository.update(updated)
        if result is None:
            raise KnowledgeGraphRegistryNotFoundError("Knowledge graph registry not found")
        return result

    def update_status(
        self, registry_id: UUID, *, status: KnowledgeGraphRegistryStatus
    ) -> KnowledgeGraphRegistry:
        current = self._repository.get(registry_id)
        if current is None:
            raise KnowledgeGraphRegistryNotFoundError("Knowledge graph registry not found")
        if not _is_valid_status_transition(current.status, status):
            raise InvalidKnowledgeGraphStatusTransitionError(
                f"Invalid status transition: {current.status.value} -> {status.value}"
            )

        if status == KnowledgeGraphRegistryStatus.POPULATED:
            self._validate_bound_ontologies(
                current.application_id, current.bound_ontology_ids
            )

        populated_at = current.populated_at
        if status == KnowledgeGraphRegistryStatus.POPULATED and populated_at is None:
            populated_at = datetime.now(UTC)

        graph_updated_at = current.graph_updated_at
        if status == KnowledgeGraphRegistryStatus.UPDATED and graph_updated_at is None:
            graph_updated_at = datetime.now(UTC)

        archived_at = current.archived_at
        if status == KnowledgeGraphRegistryStatus.ARCHIVED and archived_at is None:
            archived_at = datetime.now(UTC)

        updated = KnowledgeGraphRegistry(
            id=current.id,
            application_id=current.application_id,
            status=status,
            title=current.title,
            description=current.description,
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            populated_at=populated_at,
            graph_updated_at=graph_updated_at,
            archived_at=archived_at,
            graph_metadata=current.graph_metadata,
            bound_ontology_ids=current.bound_ontology_ids,
        )
        result = self._repository.update(updated)
        if result is None:
            raise KnowledgeGraphRegistryNotFoundError("Knowledge graph registry not found")
        return result

    def _validate_bound_ontologies(
        self, application_id: UUID, bound_ontology_ids: list[str]
    ) -> None:
        for ontology_id in bound_ontology_ids:
            try:
                ontology_uuid = UUID(ontology_id)
            except ValueError as error:
                raise OntologyDefinitionNotFoundError(
                    "Ontology definition not found"
                ) from error

            owner_id = self._ontology_reader.get_application_id(ontology_uuid)
            if owner_id is None:
                raise OntologyDefinitionNotFoundError("Ontology definition not found")
            if owner_id != application_id:
                raise InvalidOntologyBindingError(
                    "Ontology definition belongs to a different application"
                )

            ontology_status = self._ontology_reader.get_ontology_status(ontology_uuid)
            if ontology_status not in BINDABLE_ONTOLOGY_STATUSES:
                raise InvalidOntologyBindingError(
                    "Ontology definition is not bindable for knowledge graph"
                )


VALID_STATUS_TRANSITIONS: dict[
    KnowledgeGraphRegistryStatus, set[KnowledgeGraphRegistryStatus]
] = {
    KnowledgeGraphRegistryStatus.CREATED: {KnowledgeGraphRegistryStatus.POPULATED},
    KnowledgeGraphRegistryStatus.POPULATED: {
        KnowledgeGraphRegistryStatus.UPDATED,
        KnowledgeGraphRegistryStatus.ARCHIVED,
    },
    KnowledgeGraphRegistryStatus.UPDATED: {KnowledgeGraphRegistryStatus.ARCHIVED},
    KnowledgeGraphRegistryStatus.ARCHIVED: set(),
}


def _is_valid_status_transition(
    current: KnowledgeGraphRegistryStatus, target: KnowledgeGraphRegistryStatus
) -> bool:
    return target in VALID_STATUS_TRANSITIONS[current]
