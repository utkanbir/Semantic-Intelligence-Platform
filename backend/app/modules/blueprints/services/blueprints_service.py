"""Application services for the blueprints module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

from app.modules.applications.repositories.interfaces import ApplicationRepository
from app.modules.blueprints.domain.enums import BlueprintStatus
from app.modules.blueprints.domain.models import Blueprint
from app.modules.blueprints.repositories.interfaces import BlueprintRepository

UNSET = object()

DEFAULT_SNAPSHOT: dict[str, Any] = {
    "goal": "",
    "outcome": "",
    "personas": [],
    "use_cases": [],
    "knowledge_sources": [],
    "semantic_concepts": [],
    "product_definitions": [],
    "agent_definitions": [],
    "governance_requirements": [],
    "success_metrics": [],
}


class ApplicationNotFoundError(Exception):
    """Raised when the parent application does not exist."""


class BlueprintNotFoundError(Exception):
    """Raised when a blueprint cannot be found."""


class ImmutableBlueprintError(Exception):
    """Raised when mutating a locked blueprint."""


class InvalidBlueprintStatusTransitionError(Exception):
    """Raised when a blueprint status transition is not allowed."""


class InvalidBlueprintVersionForkError(Exception):
    """Raised when a blueprint version fork is not allowed."""


class BlueprintsService:
    """Blueprint CRUD orchestration."""

    def __init__(
        self,
        repository: BlueprintRepository,
        application_repository: ApplicationRepository,
    ) -> None:
        self._repository = repository
        self._application_repository = application_repository

    def create_blueprint(
        self,
        *,
        application_id: UUID,
        title: str,
        created_by: str | None = None,
        goal: str | None = None,
        outcome: str | None = None,
        blueprint_snapshot: dict[str, Any] | None = None,
    ) -> Blueprint:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")

        snapshot = (
            blueprint_snapshot if blueprint_snapshot is not None else dict(DEFAULT_SNAPSHOT)
        )
        blueprint = Blueprint(
            id=uuid4(),
            application_id=application_id,
            version_number=1,
            status=BlueprintStatus.DRAFT,
            title=title,
            goal=goal,
            outcome=outcome,
            created_by=created_by or "",
            created_at=datetime.now(UTC),
            blueprint_snapshot=snapshot,
        )
        return self._repository.create(blueprint)

    def list_blueprints(self, *, application_id: UUID) -> list[Blueprint]:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")
        return list(self._repository.list_by_application(application_id))

    def get_blueprint(self, blueprint_id: UUID) -> Blueprint:
        blueprint = self._repository.get(blueprint_id)
        if blueprint is None:
            raise BlueprintNotFoundError("Blueprint not found")
        return blueprint

    def update_blueprint(
        self,
        blueprint_id: UUID,
        *,
        title: str | None = None,
        goal: str | None | object = UNSET,
        outcome: str | None | object = UNSET,
        blueprint_snapshot: dict[str, Any] | None | object = UNSET,
    ) -> Blueprint:
        current = self._repository.get(blueprint_id)
        if current is None:
            raise BlueprintNotFoundError("Blueprint not found")
        if current.status in {BlueprintStatus.VERSIONED, BlueprintStatus.RETIRED}:
            raise ImmutableBlueprintError("Blueprint snapshot is immutable in current status")

        updated = Blueprint(
            id=current.id,
            application_id=current.application_id,
            version_number=current.version_number,
            previous_version_id=current.previous_version_id,
            status=current.status,
            title=title if title is not None else current.title,
            goal=current.goal if goal is UNSET else cast(str | None, goal),
            outcome=current.outcome if outcome is UNSET else cast(str | None, outcome),
            created_by=current.created_by,
            created_at=current.created_at,
            approved_at=current.approved_at,
            version_created_at=current.version_created_at,
            blueprint_snapshot=(
                current.blueprint_snapshot
                if blueprint_snapshot is UNSET
                else cast(dict[str, Any], blueprint_snapshot)
            ),
        )
        result = self._repository.update(updated)
        if result is None:
            raise BlueprintNotFoundError("Blueprint not found")
        return result

    def update_status(self, blueprint_id: UUID, *, status: BlueprintStatus) -> Blueprint:
        current = self._repository.get(blueprint_id)
        if current is None:
            raise BlueprintNotFoundError("Blueprint not found")
        if not _is_valid_status_transition(current.status, status):
            raise InvalidBlueprintStatusTransitionError(
                f"Invalid status transition: {current.status.value} -> {status.value}"
            )

        approved_at = current.approved_at
        if status == BlueprintStatus.APPROVED and approved_at is None:
            approved_at = datetime.now(UTC)

        updated = Blueprint(
            id=current.id,
            application_id=current.application_id,
            version_number=current.version_number,
            previous_version_id=current.previous_version_id,
            status=status,
            title=current.title,
            goal=current.goal,
            outcome=current.outcome,
            created_by=current.created_by,
            created_at=current.created_at,
            approved_at=approved_at,
            version_created_at=current.version_created_at,
            blueprint_snapshot=current.blueprint_snapshot,
        )
        result = self._repository.update(updated)
        if result is None:
            raise BlueprintNotFoundError("Blueprint not found")
        return result

    def create_version(
        self,
        blueprint_id: UUID,
        *,
        blueprint_snapshot: dict[str, Any] | None = None,
    ) -> Blueprint:
        parent = self._repository.get(blueprint_id)
        if parent is None:
            raise BlueprintNotFoundError("Blueprint not found")
        if parent.status not in {BlueprintStatus.APPROVED, BlueprintStatus.VERSIONED}:
            raise InvalidBlueprintVersionForkError(
                "Version fork requires parent status Approved or Versioned"
            )

        snapshot = (
            dict(parent.blueprint_snapshot)
            if blueprint_snapshot is None
            else blueprint_snapshot
        )
        now = datetime.now(UTC)
        child = Blueprint(
            id=uuid4(),
            application_id=parent.application_id,
            version_number=parent.version_number + 1,
            previous_version_id=parent.id,
            status=BlueprintStatus.DRAFT,
            title=parent.title,
            goal=parent.goal,
            outcome=parent.outcome,
            created_by=parent.created_by,
            created_at=now,
            version_created_at=now,
            blueprint_snapshot=snapshot,
        )
        return self._repository.create(child)


VALID_STATUS_TRANSITIONS: dict[BlueprintStatus, set[BlueprintStatus]] = {
    BlueprintStatus.DRAFT: {BlueprintStatus.REVIEW},
    BlueprintStatus.REVIEW: {BlueprintStatus.APPROVED, BlueprintStatus.DRAFT},
    BlueprintStatus.APPROVED: {BlueprintStatus.VERSIONED},
    BlueprintStatus.VERSIONED: {BlueprintStatus.RETIRED},
    BlueprintStatus.RETIRED: set(),
}


def _is_valid_status_transition(current: BlueprintStatus, target: BlueprintStatus) -> bool:
    return target in VALID_STATUS_TRANSITIONS[current]
