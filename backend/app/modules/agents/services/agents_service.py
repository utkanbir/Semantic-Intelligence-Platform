"""Application services for the agents module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

from app.modules.agents.domain.enums import AgentDefinitionStatus
from app.modules.agents.domain.models import AgentDefinition
from app.modules.agents.ports.interfaces import ConsumableProductReader, TraceRecorder
from app.modules.agents.repositories.interfaces import AgentDefinitionRepository
from app.modules.applications.repositories.interfaces import ApplicationRepository
from app.modules.products.domain.enums import PublishedDataProductStatus

UNSET = object()

DEFAULT_AGENT_DEFINITION: dict[str, Any] = {
    "schema_version": "1",
    "persona": "",
    "instructions": "",
    "tools": [],
    "output_schema": {},
    "metadata": {},
}

CONSUMABLE_PRODUCT_STATUSES = {
    PublishedDataProductStatus.PUBLISHED.value,
    PublishedDataProductStatus.VERSIONED.value,
}


class ApplicationNotFoundError(Exception):
    """Raised when the parent application does not exist."""


class AgentDefinitionNotFoundError(Exception):
    """Raised when an agent definition cannot be found."""


class ImmutableAgentDefinitionError(Exception):
    """Raised when mutating a locked agent definition."""


class PublishedDataProductNotFoundError(Exception):
    """Raised when a referenced published data product does not exist."""


class InvalidProductBindingError(Exception):
    """Raised when a product binding violates D-003 rules."""


class InvalidAgentDefinitionStatusTransitionError(Exception):
    """Raised when an agent status transition is not allowed."""


class InvalidAgentDefinitionVersionForkError(Exception):
    """Raised when an agent version fork is not allowed."""


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


class AgentsService:
    """Agent definition CRUD and lifecycle orchestration."""

    def __init__(
        self,
        repository: AgentDefinitionRepository,
        application_repository: ApplicationRepository,
        product_reader: ConsumableProductReader,
        trace_recorder: TraceRecorder | None = None,
    ) -> None:
        self._repository = repository
        self._application_repository = application_repository
        self._product_reader = product_reader
        self._trace_recorder = trace_recorder or _NoOpTraceRecorder()

    def create_agent(
        self,
        *,
        application_id: UUID,
        title: str,
        created_by: str | None = None,
        description: str | None = None,
        agent_definition: dict[str, Any] | None = None,
        bound_product_ids: list[str] | None = None,
    ) -> AgentDefinition:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")

        product_ids = bound_product_ids or []
        self._validate_bound_products(application_id, product_ids)

        now = datetime.now(UTC)
        definition = dict(DEFAULT_AGENT_DEFINITION) if agent_definition is None else agent_definition
        agent = AgentDefinition(
            id=uuid4(),
            application_id=application_id,
            version_number=1,
            status=AgentDefinitionStatus.DRAFT,
            title=title,
            description=description,
            created_by=created_by or "",
            created_at=now,
            updated_at=now,
            agent_definition=definition,
            bound_product_ids=product_ids,
        )
        created = self._repository.create(agent)
        self._trace_recorder.record_transaction(
            transaction_type="agent.created",
            resource_type="AgentDefinition",
            resource_id=str(created.id),
        )
        return created

    def list_agents(
        self,
        *,
        application_id: UUID,
        status: AgentDefinitionStatus | None = None,
    ) -> list[AgentDefinition]:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")
        status_value = status.value if status is not None else None
        return list(self._repository.list_by_application(application_id, status=status_value))

    def get_agent(self, agent_id: UUID) -> AgentDefinition:
        agent = self._repository.get(agent_id)
        if agent is None:
            raise AgentDefinitionNotFoundError("Agent definition not found")
        return agent

    def update_agent(
        self,
        agent_id: UUID,
        *,
        title: str | None = None,
        description: str | None | object = UNSET,
        agent_definition: dict[str, Any] | None | object = UNSET,
        bound_product_ids: list[str] | None | object = UNSET,
    ) -> AgentDefinition:
        current = self._repository.get(agent_id)
        if current is None:
            raise AgentDefinitionNotFoundError("Agent definition not found")
        if current.status in {AgentDefinitionStatus.VERSIONED, AgentDefinitionStatus.RETIRED}:
            raise ImmutableAgentDefinitionError(
                "Agent definition is immutable in current status"
            )

        resolved_products = (
            current.bound_product_ids
            if bound_product_ids is UNSET
            else cast(list[str], bound_product_ids)
        )
        self._validate_bound_products(current.application_id, resolved_products)

        updated = AgentDefinition(
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
            approved_at=current.approved_at,
            activated_at=current.activated_at,
            version_created_at=current.version_created_at,
            agent_definition=(
                current.agent_definition
                if agent_definition is UNSET
                else cast(dict[str, Any], agent_definition)
            ),
            bound_product_ids=resolved_products,
        )
        result = self._repository.update(updated)
        if result is None:
            raise AgentDefinitionNotFoundError("Agent definition not found")
        return result

    def update_status(
        self, agent_id: UUID, *, status: AgentDefinitionStatus
    ) -> AgentDefinition:
        current = self._repository.get(agent_id)
        if current is None:
            raise AgentDefinitionNotFoundError("Agent definition not found")
        if not _is_valid_status_transition(current.status, status):
            raise InvalidAgentDefinitionStatusTransitionError(
                f"Invalid status transition: {current.status.value} -> {status.value}"
            )

        if status == AgentDefinitionStatus.ACTIVE:
            self._validate_bound_products(current.application_id, current.bound_product_ids)

        approved_at = current.approved_at
        if status == AgentDefinitionStatus.APPROVED and approved_at is None:
            approved_at = datetime.now(UTC)

        activated_at = current.activated_at
        if status == AgentDefinitionStatus.ACTIVE and activated_at is None:
            activated_at = datetime.now(UTC)

        updated = AgentDefinition(
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
            approved_at=approved_at,
            activated_at=activated_at,
            version_created_at=current.version_created_at,
            agent_definition=current.agent_definition,
            bound_product_ids=current.bound_product_ids,
        )
        result = self._repository.update(updated)
        if result is None:
            raise AgentDefinitionNotFoundError("Agent definition not found")
        return result

    def create_version(
        self,
        agent_id: UUID,
        *,
        agent_definition: dict[str, Any] | None = None,
        bound_product_ids: list[str] | None = None,
    ) -> AgentDefinition:
        parent = self._repository.get(agent_id)
        if parent is None:
            raise AgentDefinitionNotFoundError("Agent definition not found")
        if parent.status not in {AgentDefinitionStatus.ACTIVE, AgentDefinitionStatus.VERSIONED}:
            raise InvalidAgentDefinitionVersionForkError(
                "Version fork requires parent status Active or Versioned"
            )

        definition = (
            dict(parent.agent_definition) if agent_definition is None else agent_definition
        )
        products = (
            list(parent.bound_product_ids)
            if bound_product_ids is None
            else bound_product_ids
        )
        self._validate_bound_products(parent.application_id, products)

        now = datetime.now(UTC)
        child = AgentDefinition(
            id=uuid4(),
            application_id=parent.application_id,
            version_number=parent.version_number + 1,
            previous_version_id=parent.id,
            status=AgentDefinitionStatus.DRAFT,
            title=parent.title,
            description=parent.description,
            created_by=parent.created_by,
            created_at=now,
            updated_at=now,
            version_created_at=now,
            agent_definition=definition,
            bound_product_ids=products,
        )
        return self._repository.create(child)

    def _validate_bound_products(
        self, application_id: UUID, bound_product_ids: list[str]
    ) -> None:
        for product_id in bound_product_ids:
            try:
                product_uuid = UUID(product_id)
            except ValueError as error:
                raise PublishedDataProductNotFoundError(
                    "Published data product not found"
                ) from error

            owner_id = self._product_reader.get_application_id(product_uuid)
            if owner_id is None:
                raise PublishedDataProductNotFoundError("Published data product not found")
            if owner_id != application_id:
                raise InvalidProductBindingError(
                    "Published data product belongs to a different application"
                )

            product_status = self._product_reader.get_consumable_status(product_uuid)
            if product_status not in CONSUMABLE_PRODUCT_STATUSES:
                raise InvalidProductBindingError(
                    "Published data product is not consumable for agent binding (D-003)"
                )


VALID_STATUS_TRANSITIONS: dict[AgentDefinitionStatus, set[AgentDefinitionStatus]] = {
    AgentDefinitionStatus.DRAFT: {AgentDefinitionStatus.APPROVED},
    AgentDefinitionStatus.APPROVED: {
        AgentDefinitionStatus.ACTIVE,
        AgentDefinitionStatus.DRAFT,
    },
    AgentDefinitionStatus.ACTIVE: {AgentDefinitionStatus.VERSIONED},
    AgentDefinitionStatus.VERSIONED: {AgentDefinitionStatus.RETIRED},
    AgentDefinitionStatus.RETIRED: set(),
}


def _is_valid_status_transition(
    current: AgentDefinitionStatus, target: AgentDefinitionStatus
) -> bool:
    return target in VALID_STATUS_TRANSITIONS[current]
