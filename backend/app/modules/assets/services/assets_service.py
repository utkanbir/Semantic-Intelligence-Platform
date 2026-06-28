"""Application services for the assets module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

from app.modules.applications.repositories.interfaces import ApplicationRepository
from app.modules.assets.domain.enums import AssetRecordStatus, AssetType
from app.modules.assets.domain.models import AssetRecord
from app.modules.assets.ports.interfaces import TraceRecorder
from app.modules.assets.repositories.interfaces import (
    AssetRecordRepository,
    DuplicateAssetRecordError,
)

UNSET = object()


class ApplicationNotFoundError(Exception):
    """Raised when the parent application does not exist."""


class AssetRecordNotFoundError(Exception):
    """Raised when an asset record cannot be found."""


class DuplicateAssetRecordConflictError(Exception):
    """Raised when a duplicate asset record is created."""


class InvalidAssetRecordStatusTransitionError(Exception):
    """Raised when an asset record status transition is not allowed."""


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


class AssetsService:
    """Asset registry CRUD orchestration."""

    def __init__(
        self,
        repository: AssetRecordRepository,
        application_repository: ApplicationRepository,
        trace_recorder: TraceRecorder | None = None,
    ) -> None:
        self._repository = repository
        self._application_repository = application_repository
        self._trace_recorder = trace_recorder or _NoOpTraceRecorder()

    def create_asset_record(
        self,
        *,
        application_id: UUID,
        asset_type: AssetType,
        resource_type: str,
        resource_id: str,
        title: str,
        created_by: str | None = None,
        description: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AssetRecord:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")

        now = datetime.now(UTC)
        asset_record = AssetRecord(
            id=uuid4(),
            application_id=application_id,
            asset_type=asset_type,
            resource_type=resource_type,
            resource_id=resource_id,
            status=AssetRecordStatus.DRAFT,
            title=title,
            description=description,
            created_by=created_by or "",
            created_at=now,
            updated_at=now,
            metadata=metadata,
        )
        try:
            created = self._repository.create(asset_record)
        except DuplicateAssetRecordError as error:
            raise DuplicateAssetRecordConflictError(
                "Asset record already exists for resource"
            ) from error
        self._trace_recorder.record_transaction(
            transaction_type="asset.created",
            resource_type="AssetRecord",
            resource_id=str(created.id),
        )
        return created

    def list_asset_records(
        self,
        *,
        application_id: UUID,
        asset_type: AssetType | None = None,
    ) -> list[AssetRecord]:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")
        asset_type_value = asset_type.value if asset_type is not None else None
        return list(
            self._repository.list_by_application(application_id, asset_type=asset_type_value)
        )

    def get_asset_record(self, asset_record_id: UUID) -> AssetRecord:
        asset_record = self._repository.get(asset_record_id)
        if asset_record is None:
            raise AssetRecordNotFoundError("Asset record not found")
        return asset_record

    def update_asset_record(
        self,
        asset_record_id: UUID,
        *,
        title: str | None = None,
        description: str | None | object = UNSET,
        metadata: dict[str, Any] | None | object = UNSET,
    ) -> AssetRecord:
        current = self._repository.get(asset_record_id)
        if current is None:
            raise AssetRecordNotFoundError("Asset record not found")

        resolved_metadata = (
            current.metadata if metadata is UNSET else cast(dict[str, Any] | None, metadata)
        )
        updated = AssetRecord(
            id=current.id,
            application_id=current.application_id,
            asset_type=current.asset_type,
            resource_type=current.resource_type,
            resource_id=current.resource_id,
            status=current.status,
            title=title if title is not None else current.title,
            description=(
                current.description if description is UNSET else cast(str | None, description)
            ),
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            metadata=resolved_metadata,
        )
        result = self._repository.update(updated)
        if result is None:
            raise AssetRecordNotFoundError("Asset record not found")
        return result

    def update_status(
        self, asset_record_id: UUID, *, status: AssetRecordStatus
    ) -> AssetRecord:
        current = self._repository.get(asset_record_id)
        if current is None:
            raise AssetRecordNotFoundError("Asset record not found")
        if not _is_valid_status_transition(current.status, status):
            raise InvalidAssetRecordStatusTransitionError(
                f"Invalid status transition: {current.status.value} -> {status.value}"
            )

        updated = AssetRecord(
            id=current.id,
            application_id=current.application_id,
            asset_type=current.asset_type,
            resource_type=current.resource_type,
            resource_id=current.resource_id,
            status=status,
            title=current.title,
            description=current.description,
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            metadata=current.metadata,
        )
        result = self._repository.update(updated)
        if result is None:
            raise AssetRecordNotFoundError("Asset record not found")
        return result


VALID_STATUS_TRANSITIONS: dict[AssetRecordStatus, set[AssetRecordStatus]] = {
    AssetRecordStatus.DRAFT: {AssetRecordStatus.ACTIVE},
    AssetRecordStatus.ACTIVE: {AssetRecordStatus.PUBLISHED, AssetRecordStatus.DRAFT},
    AssetRecordStatus.PUBLISHED: {AssetRecordStatus.DEPRECATED},
    AssetRecordStatus.DEPRECATED: {AssetRecordStatus.RETIRED, AssetRecordStatus.ACTIVE},
    AssetRecordStatus.RETIRED: set(),
}


def _is_valid_status_transition(
    current: AssetRecordStatus, target: AssetRecordStatus
) -> bool:
    return target in VALID_STATUS_TRANSITIONS[current]
