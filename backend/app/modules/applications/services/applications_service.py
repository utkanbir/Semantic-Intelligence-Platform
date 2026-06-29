"""Application services for the applications module."""

from __future__ import annotations

from typing import cast
from uuid import UUID, uuid4

from app.modules.applications.domain.enums import ApplicationStatus
from app.modules.applications.domain.models import Application, ApplicationWorkspace
from app.modules.applications.ports.interfaces import TraceRecorder
from app.modules.applications.repositories.interfaces import (
    ApplicationRepository,
    DuplicateApplicationKeyError,
)
from app.modules.applications.services.namespace_builder import build_namespace_fields

UNSET = object()


class ApplicationNotFoundError(Exception):
    """Raised when an application cannot be found."""


class ApplicationConflictError(Exception):
    """Raised when an application key or namespace slug conflicts with an existing one."""


class InvalidApplicationStatusTransitionError(Exception):
    """Raised when an application status transition is not allowed."""


class _NoOpTraceRecorder:
    """Default recorder when audit_trace wiring is not provided."""

    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        return None


class ApplicationsService:
    """Application CRUD and blank workspace provisioning orchestration."""

    def __init__(
        self,
        repository: ApplicationRepository,
        trace_recorder: TraceRecorder | None = None,
    ) -> None:
        self._repository = repository
        self._trace_recorder = trace_recorder or _NoOpTraceRecorder()

    def create_application(self, *, key: str, name: str, description: str | None) -> Application:
        if self._repository.get_by_key(key) is not None:
            raise ApplicationConflictError("Application key already exists")

        app_id = uuid4()
        workspace_id = uuid4()
        namespaces = build_namespace_fields(key)
        self._ensure_namespace_available(namespaces.postgres_schema)

        application = Application(
            id=app_id,
            key=key,
            name=name,
            status=ApplicationStatus.PROVISIONED,
            description=description,
            workspace=ApplicationWorkspace(
                id=workspace_id,
                application_id=app_id,
                status="provisioned",
                postgres_schema=namespaces.postgres_schema,
                minio_namespace=namespaces.minio_namespace,
                fuseki_dataset=namespaces.fuseki_dataset,
                qdrant_collection=namespaces.qdrant_collection,
                metadata_domain=namespaces.metadata_domain,
                ontology_namespace=namespaces.ontology_namespace,
                agent_namespace=namespaces.agent_namespace,
                product_registry_namespace=namespaces.product_registry_namespace,
                agent_registry_namespace=namespaces.agent_registry_namespace,
            ),
        )
        try:
            created_application = self._repository.create(application)
        except DuplicateApplicationKeyError as error:
            raise ApplicationConflictError("Application key already exists") from error
        self._trace_recorder.record_transaction(
            transaction_type="ApplicationWorkspaceProvisioned",
            resource_type="application",
            resource_id=str(created_application.id),
        )
        return created_application

    def list_applications(self) -> list[Application]:
        return list(self._repository.list())

    def get_application(self, application_id: UUID) -> Application:
        application = self._repository.get(application_id)
        if application is None:
            raise ApplicationNotFoundError("Application not found")
        return application

    def update_application(
        self,
        application_id: UUID,
        *,
        key: str | None = None,
        name: str | None = None,
        description: str | None | object = UNSET,
    ) -> Application:
        current = self._repository.get(application_id)
        if current is None:
            raise ApplicationNotFoundError("Application not found")

        next_key = key if key is not None else current.key
        next_name = name if name is not None else current.name
        next_description = (
            current.description if description is UNSET else cast(str | None, description)
        )

        workspace = current.workspace
        if workspace is None:
            raise ValueError("Application workspace is required")

        if next_key != current.key:
            if self._repository.get_by_key(next_key) is not None:
                raise ApplicationConflictError("Application key already exists")
            namespaces = build_namespace_fields(next_key)
            self._ensure_namespace_available(
                namespaces.postgres_schema,
                exclude_application_id=current.id,
            )
            workspace.postgres_schema = namespaces.postgres_schema
            workspace.minio_namespace = namespaces.minio_namespace
            workspace.fuseki_dataset = namespaces.fuseki_dataset
            workspace.qdrant_collection = namespaces.qdrant_collection
            workspace.metadata_domain = namespaces.metadata_domain
            workspace.ontology_namespace = namespaces.ontology_namespace
            workspace.agent_namespace = namespaces.agent_namespace
            workspace.product_registry_namespace = namespaces.product_registry_namespace
            workspace.agent_registry_namespace = namespaces.agent_registry_namespace

        candidate = Application(
            id=current.id,
            key=next_key,
            name=next_name,
            status=current.status,
            description=next_description,
            created_at=current.created_at,
            updated_at=current.updated_at,
            workspace=workspace,
        )

        try:
            updated = self._repository.update(candidate)
        except DuplicateApplicationKeyError as error:
            raise ApplicationConflictError("Application key already exists") from error
        if updated is None:
            raise ApplicationNotFoundError("Application not found")
        return updated

    def delete_application(self, application_id: UUID) -> None:
        deleted = self._repository.delete(application_id)
        if not deleted:
            raise ApplicationNotFoundError("Application not found")

    def update_status(self, application_id: UUID, *, status: ApplicationStatus) -> Application:
        current = self._repository.get(application_id)
        if current is None:
            raise ApplicationNotFoundError("Application not found")
        if not _is_valid_status_transition(current.status, status):
            raise InvalidApplicationStatusTransitionError(
                f"Invalid status transition: {current.status.value} -> {status.value}"
            )

        candidate = Application(
            id=current.id,
            key=current.key,
            name=current.name,
            status=status,
            description=current.description,
            created_at=current.created_at,
            updated_at=current.updated_at,
            workspace=current.workspace,
        )
        updated = self._repository.update(candidate)
        if updated is None:
            raise ApplicationNotFoundError("Application not found")
        return updated

    def _ensure_namespace_available(
        self,
        postgres_schema: str,
        *,
        exclude_application_id: UUID | None = None,
    ) -> None:
        existing = self._repository.get_by_postgres_schema(postgres_schema)
        if existing is None:
            return
        if exclude_application_id is not None and existing.id == exclude_application_id:
            return
        raise ApplicationConflictError("Application namespace slug already exists")


VALID_TRANSITIONS: dict[ApplicationStatus, set[ApplicationStatus]] = {
    ApplicationStatus.CREATED: {ApplicationStatus.PROVISIONED},
    ApplicationStatus.PROVISIONED: {ApplicationStatus.ACTIVE},
    ApplicationStatus.ACTIVE: {ApplicationStatus.EVOLVING},
    ApplicationStatus.EVOLVING: {ApplicationStatus.RETIRED},
    ApplicationStatus.RETIRED: set(),
}


def _is_valid_status_transition(current: ApplicationStatus, target: ApplicationStatus) -> bool:
    return target in VALID_TRANSITIONS[current]
