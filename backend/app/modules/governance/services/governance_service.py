"""Application services for the governance module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

from app.modules.governance.domain.enums import PolicyDefinitionStatus
from app.modules.governance.domain.models import PolicyDefinition
from app.modules.governance.ports.interfaces import TraceRecorder
from app.modules.governance.repositories.interfaces import PolicyDefinitionRepository

UNSET = object()

DEFAULT_POLICY_DEFINITION: dict[str, Any] = {
    "schema_version": "1",
    "intent": "",
    "scope": "platform",
    "rules": [],
    "metadata": {},
}


class PolicyDefinitionNotFoundError(Exception):
    pass


class DuplicatePolicyKeyError(Exception):
    pass


class ImmutablePolicyDefinitionError(Exception):
    pass


class InvalidPolicyDefinitionStatusTransitionError(Exception):
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


class GovernanceService:
    """Policy definition CRUD and lifecycle orchestration."""

    def __init__(
        self,
        repository: PolicyDefinitionRepository,
        trace_recorder: TraceRecorder | None = None,
    ) -> None:
        self._repository = repository
        self._trace_recorder = trace_recorder or _NoOpTraceRecorder()

    def create_policy(
        self,
        *,
        policy_key: str,
        title: str,
        created_by: str | None = None,
        description: str | None = None,
        policy_definition: dict[str, Any] | None = None,
    ) -> PolicyDefinition:
        if self._repository.get_by_key(policy_key) is not None:
            raise DuplicatePolicyKeyError("Policy key already exists")

        now = datetime.now(UTC)
        definition = (
            dict(DEFAULT_POLICY_DEFINITION)
            if policy_definition is None
            else policy_definition
        )
        policy = PolicyDefinition(
            id=uuid4(),
            policy_key=policy_key,
            status=PolicyDefinitionStatus.DRAFT,
            title=title,
            description=description,
            created_by=created_by or "",
            created_at=now,
            updated_at=now,
            policy_definition=definition,
        )
        created = self._repository.create(policy)
        self._trace_recorder.record_transaction(
            transaction_type="policy.created",
            resource_type="PolicyDefinition",
            resource_id=str(created.id),
        )
        return created

    def list_policies(
        self, *, status: PolicyDefinitionStatus | None = None
    ) -> list[PolicyDefinition]:
        status_value = status.value if status is not None else None
        return list(self._repository.list_all(status=status_value))

    def get_policy(self, policy_id: UUID) -> PolicyDefinition:
        policy = self._repository.get(policy_id)
        if policy is None:
            raise PolicyDefinitionNotFoundError("Policy definition not found")
        return policy

    def update_policy(
        self,
        policy_id: UUID,
        *,
        title: str | None = None,
        description: str | None | object = UNSET,
        policy_definition: dict[str, Any] | None | object = UNSET,
    ) -> PolicyDefinition:
        current = self._repository.get(policy_id)
        if current is None:
            raise PolicyDefinitionNotFoundError("Policy definition not found")
        if current.status == PolicyDefinitionStatus.RETIRED:
            raise ImmutablePolicyDefinitionError(
                "Policy definition is immutable in Retired status"
            )

        updated = PolicyDefinition(
            id=current.id,
            policy_key=current.policy_key,
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
            retired_at=current.retired_at,
            policy_definition=(
                current.policy_definition
                if policy_definition is UNSET
                else cast(dict[str, Any], policy_definition)
            ),
        )
        result = self._repository.update(updated)
        if result is None:
            raise PolicyDefinitionNotFoundError("Policy definition not found")
        return result

    def update_status(
        self, policy_id: UUID, *, status: PolicyDefinitionStatus
    ) -> PolicyDefinition:
        current = self._repository.get(policy_id)
        if current is None:
            raise PolicyDefinitionNotFoundError("Policy definition not found")
        if not _is_valid_status_transition(current.status, status):
            raise InvalidPolicyDefinitionStatusTransitionError(
                f"Invalid status transition: {current.status.value} -> {status.value}"
            )

        approved_at = current.approved_at
        if status == PolicyDefinitionStatus.APPROVED and approved_at is None:
            approved_at = datetime.now(UTC)

        activated_at = current.activated_at
        if status == PolicyDefinitionStatus.ACTIVE and activated_at is None:
            activated_at = datetime.now(UTC)

        retired_at = current.retired_at
        if status == PolicyDefinitionStatus.RETIRED and retired_at is None:
            retired_at = datetime.now(UTC)

        updated = PolicyDefinition(
            id=current.id,
            policy_key=current.policy_key,
            status=status,
            title=current.title,
            description=current.description,
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            approved_at=approved_at,
            activated_at=activated_at,
            retired_at=retired_at,
            policy_definition=current.policy_definition,
        )
        result = self._repository.update(updated)
        if result is None:
            raise PolicyDefinitionNotFoundError("Policy definition not found")
        return result


VALID_STATUS_TRANSITIONS: dict[
    PolicyDefinitionStatus, set[PolicyDefinitionStatus]
] = {
    PolicyDefinitionStatus.DRAFT: {PolicyDefinitionStatus.APPROVED},
    PolicyDefinitionStatus.APPROVED: {
        PolicyDefinitionStatus.ACTIVE,
        PolicyDefinitionStatus.DRAFT,
    },
    PolicyDefinitionStatus.ACTIVE: {PolicyDefinitionStatus.RETIRED},
    PolicyDefinitionStatus.RETIRED: set(),
}


def _is_valid_status_transition(
    current: PolicyDefinitionStatus, target: PolicyDefinitionStatus
) -> bool:
    return target in VALID_STATUS_TRANSITIONS[current]
