"""Application services for the adapters module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.modules.adapters.domain.enums import TechnologyAdapterStatus, TechnologyType
from app.modules.adapters.domain.models import TechnologyAdapter
from app.modules.adapters.ports.interfaces import TraceRecorder
from app.modules.adapters.repositories.interfaces import TechnologyAdapterRepository
from app.modules.adapters.services.adapter_stubs import AdapterFactory

UNSET = object()

DEFAULT_ADAPTER_CONFIGURATION: dict[str, Any] = {
    "schema_version": "1",
    "endpoint": "",
    "metadata": {},
}


class TechnologyAdapterNotFoundError(Exception):
    """Raised when a technology adapter cannot be found."""


class DuplicateAdapterKeyError(Exception):
    """Raised when adapter_key is not unique."""


class ImmutableTechnologyAdapterError(Exception):
    """Raised when mutating a locked technology adapter."""


class InvalidTechnologyAdapterStatusTransitionError(Exception):
    """Raised when a status transition is not allowed."""


class AdapterNotActiveError(Exception):
    """Raised when ping is attempted on a non-active adapter."""


class _NoOpTraceRecorder:
    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        return None


class AdaptersService:
    """Technology adapter CRUD, lifecycle, and stub ping orchestration."""

    def __init__(
        self,
        repository: TechnologyAdapterRepository,
        trace_recorder: TraceRecorder | None = None,
        *,
        session: Session | None = None,
    ) -> None:
        self._repository = repository
        self._trace_recorder = trace_recorder or _NoOpTraceRecorder()
        self._session = session

    def create_adapter(
        self,
        *,
        technology_type: TechnologyType,
        adapter_key: str,
        title: str,
        created_by: str | None = None,
        description: str | None = None,
        adapter_configuration: dict[str, Any] | None = None,
    ) -> TechnologyAdapter:
        if self._repository.get_by_key(adapter_key) is not None:
            raise DuplicateAdapterKeyError("Adapter key already exists")

        now = datetime.now(UTC)
        config = (
            dict(DEFAULT_ADAPTER_CONFIGURATION)
            if adapter_configuration is None
            else adapter_configuration
        )
        adapter = TechnologyAdapter(
            id=uuid4(),
            technology_type=technology_type,
            adapter_key=adapter_key,
            status=TechnologyAdapterStatus.REGISTERED,
            title=title,
            description=description,
            created_by=created_by or "",
            created_at=now,
            updated_at=now,
            adapter_configuration=config,
        )
        created = self._repository.create(adapter)
        self._trace_recorder.record_transaction(
            transaction_type="adapter.registered",
            resource_type="TechnologyAdapter",
            resource_id=str(created.id),
        )
        return created

    def list_adapters(
        self,
        *,
        technology_type: TechnologyType | None = None,
        status: TechnologyAdapterStatus | None = None,
    ) -> list[TechnologyAdapter]:
        type_value = technology_type.value if technology_type is not None else None
        status_value = status.value if status is not None else None
        return list(
            self._repository.list_all(technology_type=type_value, status=status_value)
        )

    def get_adapter(self, adapter_id: UUID) -> TechnologyAdapter:
        adapter = self._repository.get(adapter_id)
        if adapter is None:
            raise TechnologyAdapterNotFoundError("Technology adapter not found")
        return adapter

    def update_adapter(
        self,
        adapter_id: UUID,
        *,
        title: str | None = None,
        description: str | None | object = UNSET,
        adapter_configuration: dict[str, Any] | None | object = UNSET,
    ) -> TechnologyAdapter:
        current = self._repository.get(adapter_id)
        if current is None:
            raise TechnologyAdapterNotFoundError("Technology adapter not found")
        if current.status in {
            TechnologyAdapterStatus.DEPRECATED,
            TechnologyAdapterStatus.RETIRED,
        }:
            raise ImmutableTechnologyAdapterError(
                "Technology adapter is immutable in current status"
            )

        updated = TechnologyAdapter(
            id=current.id,
            technology_type=current.technology_type,
            adapter_key=current.adapter_key,
            status=current.status,
            title=title if title is not None else current.title,
            description=(
                current.description if description is UNSET else cast(str | None, description)
            ),
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            configured_at=current.configured_at,
            activated_at=current.activated_at,
            deprecated_at=current.deprecated_at,
            retired_at=current.retired_at,
            adapter_configuration=(
                current.adapter_configuration
                if adapter_configuration is UNSET
                else cast(dict[str, Any], adapter_configuration)
            ),
        )
        result = self._repository.update(updated)
        if result is None:
            raise TechnologyAdapterNotFoundError("Technology adapter not found")
        return result

    def update_status(
        self, adapter_id: UUID, *, status: TechnologyAdapterStatus
    ) -> TechnologyAdapter:
        current = self._repository.get(adapter_id)
        if current is None:
            raise TechnologyAdapterNotFoundError("Technology adapter not found")
        if not _is_valid_status_transition(current.status, status):
            raise InvalidTechnologyAdapterStatusTransitionError(
                f"Invalid status transition: {current.status.value} -> {status.value}"
            )

        configured_at = current.configured_at
        if status == TechnologyAdapterStatus.CONFIGURED and configured_at is None:
            configured_at = datetime.now(UTC)

        activated_at = current.activated_at
        if status == TechnologyAdapterStatus.ACTIVE and activated_at is None:
            activated_at = datetime.now(UTC)

        deprecated_at = current.deprecated_at
        if status == TechnologyAdapterStatus.DEPRECATED and deprecated_at is None:
            deprecated_at = datetime.now(UTC)

        retired_at = current.retired_at
        if status == TechnologyAdapterStatus.RETIRED and retired_at is None:
            retired_at = datetime.now(UTC)

        updated = TechnologyAdapter(
            id=current.id,
            technology_type=current.technology_type,
            adapter_key=current.adapter_key,
            status=status,
            title=current.title,
            description=current.description,
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            configured_at=configured_at,
            activated_at=activated_at,
            deprecated_at=deprecated_at,
            retired_at=retired_at,
            adapter_configuration=current.adapter_configuration,
        )
        result = self._repository.update(updated)
        if result is None:
            raise TechnologyAdapterNotFoundError("Technology adapter not found")
        return result

    def ping_adapter(self, adapter_id: UUID) -> dict[str, str]:
        adapter = self.get_adapter(adapter_id)
        if adapter.status != TechnologyAdapterStatus.ACTIVE:
            raise AdapterNotActiveError("Technology adapter must be Active to ping")
        if self._session is None:
            raise RuntimeError("Database session required for adapter ping")
        factory = AdapterFactory(self._session)
        return factory.ping(adapter.technology_type.value)


VALID_STATUS_TRANSITIONS: dict[
    TechnologyAdapterStatus, set[TechnologyAdapterStatus]
] = {
    TechnologyAdapterStatus.REGISTERED: {TechnologyAdapterStatus.CONFIGURED},
    TechnologyAdapterStatus.CONFIGURED: {
        TechnologyAdapterStatus.ACTIVE,
        TechnologyAdapterStatus.REGISTERED,
    },
    TechnologyAdapterStatus.ACTIVE: {TechnologyAdapterStatus.DEPRECATED},
    TechnologyAdapterStatus.DEPRECATED: {TechnologyAdapterStatus.RETIRED},
    TechnologyAdapterStatus.RETIRED: set(),
}


def _is_valid_status_transition(
    current: TechnologyAdapterStatus, target: TechnologyAdapterStatus
) -> bool:
    return target in VALID_STATUS_TRANSITIONS[current]
