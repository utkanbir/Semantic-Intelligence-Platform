"""Application services for the adapters module."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.infrastructure.adapters.connector_port_resolver import (
    UnsupportedConnectorPortError,
    resolve_connector_port,
)
from app.infrastructure.adapters.fuseki import FusekiImportError
from app.modules.adapters.domain.enums import ConnectorType, TechnologyAdapterStatus
from app.modules.adapters.domain.models import TechnologyAdapter
from app.modules.adapters.ports.interfaces import TraceRecorder
from app.modules.adapters.repositories.interfaces import TechnologyAdapterRepository
from app.modules.adapters.services.connector_key import resolve_unique_connector_key
from app.modules.adapters.services.connector_provision import (
    build_provision_block,
    is_idempotent_provision_status,
    provision_response_from_block,
    read_connection_method,
    read_provision_block,
    read_vendor,
    requires_provision_in_cluster,
    resolve_endpoint_stub,
)

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


class ConnectorProvisionNotAllowedError(Exception):
    """Raised when connector cannot be provisioned in current state."""


class UnsupportedProvisionVendorError(Exception):
    """Raised when vendor has no in-cluster endpoint stub."""


class ConnectorConnectionTestError(Exception):
    """Raised when connector configuration fails connectivity test."""


class _NoOpTraceRecorder:
    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        return None

    def record_transaction_with_steps(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
        steps: Sequence[tuple[str, str | None]],
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
        technology_type: ConnectorType,
        adapter_key: str | None = None,
        title: str,
        created_by: str | None = None,
        description: str | None = None,
        adapter_configuration: dict[str, Any] | None = None,
    ) -> TechnologyAdapter:
        now = datetime.now(UTC)
        config = (
            dict(DEFAULT_ADAPTER_CONFIGURATION)
            if adapter_configuration is None
            else adapter_configuration
        )

        resolved_key = (adapter_key or "").strip()
        if not resolved_key:
            resolved_key = resolve_unique_connector_key(
                title=title,
                adapter_configuration=config,
                key_exists=lambda key: self._repository.get_by_key(key) is not None,
            )
        elif self._repository.get_by_key(resolved_key) is not None:
            raise DuplicateAdapterKeyError("Adapter key already exists")

        connection_method = read_connection_method(config)
        is_provision = connection_method == "provision_in_cluster"
        if not is_provision:
            self.test_connector_configuration(
                technology_type=technology_type,
                adapter_configuration=config,
            )

        adapter = TechnologyAdapter(
            id=uuid4(),
            technology_type=technology_type,
            adapter_key=resolved_key,
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
        if is_provision:
            return created
        return self._activate_after_successful_test(created)

    def test_connector_configuration(
        self,
        *,
        technology_type: ConnectorType,
        adapter_configuration: dict[str, Any],
    ) -> dict[str, str]:
        if self._session is None:
            raise RuntimeError("Database session required for connector test")
        try:
            port = resolve_connector_port(
                technology_type,
                adapter_configuration,
                session=self._session,
            )
            return port.ping()
        except (UnsupportedConnectorPortError, FusekiImportError, ValueError) as error:
            raise ConnectorConnectionTestError(str(error)) from error

    def _activate_after_successful_test(self, adapter: TechnologyAdapter) -> TechnologyAdapter:
        self.test_connector_configuration(
            technology_type=adapter.technology_type,
            adapter_configuration=adapter.adapter_configuration,
        )
        configured = self.update_status(adapter.id, status=TechnologyAdapterStatus.CONFIGURED)
        activated = self.update_status(configured.id, status=TechnologyAdapterStatus.ACTIVE)
        self._trace_recorder.record_transaction_with_steps(
            transaction_type="adapter.activated",
            resource_type="TechnologyAdapter",
            resource_id=str(activated.id),
            steps=[
                ("test_connection", "Validated connector connectivity"),
                ("configure", "Marked connector as Configured"),
                ("activate", "Marked connector as Active"),
            ],
        )
        return activated

    def list_adapters(
        self,
        *,
        technology_type: ConnectorType | None = None,
        status: TechnologyAdapterStatus | None = None,
    ) -> list[TechnologyAdapter]:
        type_value = technology_type.value if technology_type is not None else None
        status_value = status.value if status is not None else None
        return list(
            self._repository.list_all(connector_type=type_value, status=status_value)
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
        try:
            port = resolve_connector_port(
                adapter.technology_type,
                adapter.adapter_configuration,
                session=self._session,
            )
            return port.ping()
        except (UnsupportedConnectorPortError, FusekiImportError, ValueError) as error:
            raise ConnectorConnectionTestError(str(error)) from error

    def provision_connector(self, adapter_id: UUID) -> dict[str, Any]:
        adapter = self.get_adapter(adapter_id)
        if adapter.status in {
            TechnologyAdapterStatus.DEPRECATED,
            TechnologyAdapterStatus.RETIRED,
        }:
            raise ConnectorProvisionNotAllowedError(
                "Connector cannot be provisioned in Deprecated or Retired status"
            )

        configuration = dict(adapter.adapter_configuration)
        connection_method = read_connection_method(configuration)
        if connection_method == "existing_instance":
            raise ConnectorProvisionNotAllowedError(
                "Connector connection_method existing_instance cannot be provisioned in cluster"
            )

        existing_provision = read_provision_block(configuration)
        if existing_provision is not None and is_idempotent_provision_status(
            existing_provision.get("status")
            if isinstance(existing_provision.get("status"), str)
            else None
        ):
            if adapter.status != TechnologyAdapterStatus.ACTIVE:
                adapter = self._activate_after_successful_test(adapter)
            return provision_response_from_block(adapter.id, existing_provision)

        if adapter.status not in {
            TechnologyAdapterStatus.REGISTERED,
            TechnologyAdapterStatus.CONFIGURED,
        }:
            raise ConnectorProvisionNotAllowedError(
                "Connector must be Registered or Configured to provision"
            )
        if not requires_provision_in_cluster(configuration):
            raise ConnectorProvisionNotAllowedError(
                "Connector connection_method must be provision_in_cluster"
            )

        vendor = read_vendor(configuration)
        if vendor is None:
            raise ConnectorProvisionNotAllowedError("Connector vendor is required for provision")

        endpoint = resolve_endpoint_stub(vendor)
        if endpoint is None:
            raise UnsupportedProvisionVendorError(
                f"No in-cluster endpoint stub configured for vendor: {vendor}"
            )

        started_at = datetime.now(UTC)
        provision = build_provision_block(vendor=vendor, endpoint=endpoint, started_at=started_at)
        updated_configuration = {**configuration, "provision": provision}
        updated = self._apply_configuration_update(adapter, updated_configuration)

        self._trace_recorder.record_transaction_with_steps(
            transaction_type="connector.provisioned",
            resource_type="TechnologyAdapter",
            resource_id=str(adapter.id),
            steps=[
                ("validate_connector", "Validated connector provision request"),
                ("resolve_endpoint", f"Resolved endpoint stub for {vendor}"),
                ("update_configuration", "Updated connector_configuration.provision"),
                ("finalize", "Connector provision completed"),
            ],
        )
        activated = self._activate_after_successful_test(updated)
        return provision_response_from_block(activated.id, provision)

    def _apply_configuration_update(
        self,
        current: TechnologyAdapter,
        adapter_configuration: dict[str, Any],
    ) -> TechnologyAdapter:
        updated = TechnologyAdapter(
            id=current.id,
            technology_type=current.technology_type,
            adapter_key=current.adapter_key,
            status=current.status,
            title=current.title,
            description=current.description,
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            configured_at=current.configured_at,
            activated_at=current.activated_at,
            deprecated_at=current.deprecated_at,
            retired_at=current.retired_at,
            adapter_configuration=adapter_configuration,
        )
        result = self._repository.update(updated)
        if result is None:
            raise TechnologyAdapterNotFoundError("Technology adapter not found")
        return result


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
