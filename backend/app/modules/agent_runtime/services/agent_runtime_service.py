"""Application services for the agent_runtime module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from app.modules.agent_runtime.domain.enums import AgentRunStatus
from app.modules.agent_runtime.domain.models import AgentRun
from app.modules.agent_runtime.ports.interfaces import (
    ConsumableProductReader,
    ExecutableAgentReader,
    TraceRecorder,
)
from app.modules.agent_runtime.repositories.interfaces import AgentRunRepository
from app.modules.agents.domain.enums import AgentDefinitionStatus
from app.modules.applications.repositories.interfaces import ApplicationRepository
from app.modules.products.domain.enums import PublishedDataProductStatus

EXECUTABLE_AGENT_STATUSES = {
    AgentDefinitionStatus.ACTIVE.value,
    AgentDefinitionStatus.VERSIONED.value,
}

CONSUMABLE_PRODUCT_STATUSES = {
    PublishedDataProductStatus.PUBLISHED.value,
    PublishedDataProductStatus.VERSIONED.value,
}


class ApplicationNotFoundError(Exception):
    pass


class AgentDefinitionNotFoundError(Exception):
    pass


class AgentRunNotFoundError(Exception):
    pass


class AgentNotExecutableError(Exception):
    pass


class InvalidProductBindingError(Exception):
    pass


class PublishedDataProductNotFoundError(Exception):
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


class AgentRuntimeService:
    """Agent run stub execution with D-003 enforcement."""

    def __init__(
        self,
        repository: AgentRunRepository,
        application_repository: ApplicationRepository,
        agent_reader: ExecutableAgentReader,
        product_reader: ConsumableProductReader,
        trace_recorder: TraceRecorder | None = None,
    ) -> None:
        self._repository = repository
        self._application_repository = application_repository
        self._agent_reader = agent_reader
        self._product_reader = product_reader
        self._trace_recorder = trace_recorder or _NoOpTraceRecorder()

    def start_run(
        self,
        *,
        application_id: UUID,
        agent_definition_id: UUID,
        created_by: str | None = None,
        run_payload: dict[str, Any] | None = None,
    ) -> AgentRun:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")

        owner_id = self._agent_reader.get_application_id(agent_definition_id)
        if owner_id is None:
            raise AgentDefinitionNotFoundError("Agent definition not found")
        if owner_id != application_id:
            raise AgentDefinitionNotFoundError("Agent definition not found")

        agent_status = self._agent_reader.get_agent_status(agent_definition_id)
        if agent_status not in EXECUTABLE_AGENT_STATUSES:
            raise AgentNotExecutableError(
                "Agent definition must be Active or Versioned to execute"
            )

        bound_product_ids = self._agent_reader.get_bound_product_ids(agent_definition_id)
        if bound_product_ids is None:
            raise AgentDefinitionNotFoundError("Agent definition not found")
        self._validate_bound_products(application_id, bound_product_ids)

        now = datetime.now(UTC)
        payload = run_payload or {}
        run = AgentRun(
            id=uuid4(),
            application_id=application_id,
            agent_definition_id=agent_definition_id,
            status=AgentRunStatus.PENDING,
            created_by=created_by or "",
            created_at=now,
            updated_at=now,
            run_payload=payload,
            started_at=now,
        )
        created = self._repository.create(run)
        self._trace_recorder.record_transaction(
            transaction_type="agent.run.started",
            resource_type="AgentRun",
            resource_id=str(created.id),
        )

        completed = AgentRun(
            id=created.id,
            application_id=created.application_id,
            agent_definition_id=created.agent_definition_id,
            status=AgentRunStatus.COMPLETED,
            created_by=created.created_by,
            created_at=created.created_at,
            updated_at=datetime.now(UTC),
            run_payload=created.run_payload,
            started_at=created.started_at,
            completed_at=datetime.now(UTC),
            run_result={
                "schema_version": "1",
                "status": "stub_completed",
                "agent_definition_id": str(agent_definition_id),
                "bound_product_ids": bound_product_ids,
                "echo": payload,
            },
        )
        result = self._repository.update(completed)
        if result is None:
            raise AgentRunNotFoundError("Agent run not found")
        return result

    def list_runs(
        self,
        *,
        application_id: UUID,
        status: AgentRunStatus | None = None,
    ) -> list[AgentRun]:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")
        status_value = status.value if status is not None else None
        return list(
            self._repository.list_by_application(application_id, status=status_value)
        )

    def get_run(self, run_id: UUID) -> AgentRun:
        run = self._repository.get(run_id)
        if run is None:
            raise AgentRunNotFoundError("Agent run not found")
        return run

    def _validate_bound_products(
        self, application_id: UUID, bound_product_ids: list[str]
    ) -> None:
        if not bound_product_ids:
            raise InvalidProductBindingError(
                "Agent run requires at least one consumable bound product (D-003)"
            )
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
                    "Published data product is not consumable for agent run (D-003)"
                )
