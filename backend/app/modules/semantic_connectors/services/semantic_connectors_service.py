"""Application services for the semantic_connectors module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from app.modules.adapters.domain.enums import TechnologyAdapterStatus, TechnologyType
from app.modules.adapters.repositories.interfaces import TechnologyAdapterRepository
from app.modules.semantic_connectors.domain.enums import (
    SemanticConnectorStatus,
    SemanticConnectorType,
)
from app.modules.semantic_connectors.domain.models import SemanticConnector
from app.modules.semantic_connectors.repositories.interfaces import SemanticConnectorRepository

DEFAULT_CONNECTOR_CONFIGURATION: dict[str, Any] = {
    "schema_version": "1",
    "artifact_prefix": "",
    "metadata": {},
}

CONNECTOR_TYPE_ADAPTER_MAP: dict[SemanticConnectorType, set[TechnologyType]] = {
    SemanticConnectorType.ONTOLOGY_STORE: {TechnologyType.MINIO},
    SemanticConnectorType.KNOWLEDGE_GRAPH_STORE: {TechnologyType.FUSEKI},
}


class SemanticConnectorNotFoundError(Exception):
    """Raised when a semantic connector cannot be found."""


class DuplicateConnectorKeyError(Exception):
    """Raised when connector_key is not unique."""


class InvalidSemanticConnectorBindingError(Exception):
    """Raised when technology adapter is not eligible for connector type."""


class TechnologyAdapterNotFoundError(Exception):
    """Raised when the bound technology adapter does not exist."""


class SemanticConnectorsService:
    """Platform semantic connector registry orchestration."""

    def __init__(
        self,
        repository: SemanticConnectorRepository,
        adapter_repository: TechnologyAdapterRepository,
    ) -> None:
        self._repository = repository
        self._adapter_repository = adapter_repository

    def create_connector(
        self,
        *,
        connector_key: str,
        connector_type: SemanticConnectorType,
        title: str,
        technology_adapter_id: UUID,
        created_by: str | None = None,
        description: str | None = None,
        connector_configuration: dict[str, Any] | None = None,
    ) -> SemanticConnector:
        if self._repository.get_by_key(connector_key) is not None:
            raise DuplicateConnectorKeyError("Connector key already exists")

        adapter = self._adapter_repository.get(technology_adapter_id)
        if adapter is None:
            raise TechnologyAdapterNotFoundError("Technology adapter not found")
        if adapter.status != TechnologyAdapterStatus.ACTIVE:
            raise InvalidSemanticConnectorBindingError(
                "Technology adapter must be Active to bind a semantic connector"
            )
        allowed_types = CONNECTOR_TYPE_ADAPTER_MAP[connector_type]
        if adapter.technology_type not in allowed_types:
            raise InvalidSemanticConnectorBindingError(
                f"Connector type {connector_type.value} requires adapter technology "
                f"{', '.join(item.value for item in allowed_types)}"
            )

        now = datetime.now(UTC)
        config = (
            dict(DEFAULT_CONNECTOR_CONFIGURATION)
            if connector_configuration is None
            else connector_configuration
        )
        connector = SemanticConnector(
            id=uuid4(),
            connector_key=connector_key,
            connector_type=connector_type,
            status=SemanticConnectorStatus.ACTIVE,
            title=title,
            description=description,
            technology_adapter_id=technology_adapter_id,
            created_by=created_by or "",
            created_at=now,
            updated_at=now,
            connector_configuration=config,
        )
        return self._repository.create(connector)

    def list_connectors(
        self,
        *,
        connector_type: SemanticConnectorType | None = None,
        active_only: bool = False,
    ) -> list[SemanticConnector]:
        return list(
            self._repository.list_all(
                connector_type=connector_type,
                active_only=active_only,
            )
        )

    def get_connector(self, connector_id: UUID) -> SemanticConnector:
        connector = self._repository.get(connector_id)
        if connector is None:
            raise SemanticConnectorNotFoundError("Semantic connector not found")
        return connector
