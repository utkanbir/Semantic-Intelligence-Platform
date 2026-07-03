"""Connector in-cluster provisioning helpers (MVP stub orchestration)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.modules.adapters.domain.enums import ConnectionMethod, ProvisionStatus

VENDOR_ENDPOINT_STUBS: dict[str, str] = {
    "minio": "http://sip-minio.sip-dev.svc.cluster.local:9000",
    "apache_fuseki": "http://sip-fuseki.sip-dev.svc.cluster.local:3030",
}

_IDEMPOTENT_PROVISION_STATUSES = {
    ProvisionStatus.PROVISIONING.value,
    ProvisionStatus.PROVISIONED.value,
}


def read_connection_method(configuration: dict[str, Any]) -> str | None:
    method = configuration.get("connection_method")
    return method if isinstance(method, str) else None


def read_vendor(configuration: dict[str, Any]) -> str | None:
    vendor = configuration.get("vendor")
    return vendor if isinstance(vendor, str) else None


def read_provision_block(configuration: dict[str, Any]) -> dict[str, Any] | None:
    provision = configuration.get("provision")
    return provision if isinstance(provision, dict) else None


def is_idempotent_provision_status(status: str | None) -> bool:
    return status in _IDEMPOTENT_PROVISION_STATUSES


def resolve_endpoint_stub(vendor: str) -> str | None:
    return VENDOR_ENDPOINT_STUBS.get(vendor)


def build_provision_block(
    *,
    vendor: str,
    endpoint: str,
    started_at: datetime | None = None,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    started = started_at or now
    return {
        "status": ProvisionStatus.PROVISIONED.value,
        "vendor": vendor,
        "endpoint": endpoint,
        "started_at": started.isoformat(),
        "completed_at": now.isoformat(),
    }


def provision_response_from_block(
    connector_id: UUID, provision: dict[str, Any]
) -> dict[str, Any]:
    return {
        "connector_id": connector_id,
        "status": provision.get("status"),
        "endpoint": provision.get("endpoint"),
        "started_at": provision.get("started_at"),
        "completed_at": provision.get("completed_at"),
    }


def requires_provision_in_cluster(configuration: dict[str, Any]) -> bool:
    return read_connection_method(configuration) == ConnectionMethod.PROVISION_IN_CLUSTER.value
