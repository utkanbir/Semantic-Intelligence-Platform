"""Application services for the products module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

from app.modules.applications.repositories.interfaces import ApplicationRepository
from app.modules.assets.repositories.interfaces import AssetRecordRepository
from app.modules.products.domain.enums import PublishedDataProductStatus
from app.modules.products.domain.models import PublishedDataProduct
from app.modules.products.repositories.interfaces import PublishedDataProductRepository

UNSET = object()

DEFAULT_PRODUCT_DEFINITION: dict[str, Any] = {
    "schema_version": "1",
    "fields": [],
    "quality_rules": [],
    "access_policy": {},
    "metadata": {},
}


class ApplicationNotFoundError(Exception):
    """Raised when the parent application does not exist."""


class PublishedDataProductNotFoundError(Exception):
    """Raised when a published data product cannot be found."""


class ImmutablePublishedDataProductError(Exception):
    """Raised when mutating a locked published data product."""


class AssetRecordNotFoundError(Exception):
    """Raised when a referenced asset record does not exist."""


class InvalidAssetRecordReferenceError(Exception):
    """Raised when a referenced asset record belongs to another application."""


class ProductsService:
    """Published data product CRUD orchestration."""

    def __init__(
        self,
        repository: PublishedDataProductRepository,
        application_repository: ApplicationRepository,
        asset_record_repository: AssetRecordRepository,
    ) -> None:
        self._repository = repository
        self._application_repository = application_repository
        self._asset_record_repository = asset_record_repository

    def create_product(
        self,
        *,
        application_id: UUID,
        title: str,
        created_by: str | None = None,
        description: str | None = None,
        product_definition: dict[str, Any] | None = None,
        source_asset_record_ids: list[str] | None = None,
    ) -> PublishedDataProduct:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")

        source_ids = source_asset_record_ids or []
        self._validate_source_asset_records(application_id, source_ids)

        now = datetime.now(UTC)
        if product_definition is not None:
            definition = product_definition
        else:
            definition = dict(DEFAULT_PRODUCT_DEFINITION)
        product = PublishedDataProduct(
            id=uuid4(),
            application_id=application_id,
            version_number=1,
            status=PublishedDataProductStatus.DRAFT,
            title=title,
            description=description,
            created_by=created_by or "",
            created_at=now,
            updated_at=now,
            product_definition=definition,
            source_asset_record_ids=source_ids,
        )
        return self._repository.create(product)

    def list_products(
        self,
        *,
        application_id: UUID,
        status: PublishedDataProductStatus | None = None,
    ) -> list[PublishedDataProduct]:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")
        status_value = status.value if status is not None else None
        return list(self._repository.list_by_application(application_id, status=status_value))

    def get_product(self, product_id: UUID) -> PublishedDataProduct:
        product = self._repository.get(product_id)
        if product is None:
            raise PublishedDataProductNotFoundError("Published data product not found")
        return product

    def update_product(
        self,
        product_id: UUID,
        *,
        title: str | None = None,
        description: str | None | object = UNSET,
        product_definition: dict[str, Any] | None | object = UNSET,
        source_asset_record_ids: list[str] | None | object = UNSET,
    ) -> PublishedDataProduct:
        current = self._repository.get(product_id)
        if current is None:
            raise PublishedDataProductNotFoundError("Published data product not found")
        if current.status in {
            PublishedDataProductStatus.VERSIONED,
            PublishedDataProductStatus.RETIRED,
        }:
            raise ImmutablePublishedDataProductError(
                "Published data product definition is immutable in current status"
            )

        resolved_sources = (
            current.source_asset_record_ids
            if source_asset_record_ids is UNSET
            else cast(list[str], source_asset_record_ids)
        )
        self._validate_source_asset_records(current.application_id, resolved_sources)

        updated = PublishedDataProduct(
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
            certified_at=current.certified_at,
            published_at=current.published_at,
            version_created_at=current.version_created_at,
            product_definition=(
                current.product_definition
                if product_definition is UNSET
                else cast(dict[str, Any], product_definition)
            ),
            source_asset_record_ids=resolved_sources,
        )
        result = self._repository.update(updated)
        if result is None:
            raise PublishedDataProductNotFoundError("Published data product not found")
        return result

    def _validate_source_asset_records(
        self, application_id: UUID, source_asset_record_ids: list[str]
    ) -> None:
        for asset_record_id in source_asset_record_ids:
            try:
                asset_uuid = UUID(asset_record_id)
            except ValueError as error:
                raise AssetRecordNotFoundError("Asset record not found") from error

            asset_record = self._asset_record_repository.get(asset_uuid)
            if asset_record is None:
                raise AssetRecordNotFoundError("Asset record not found")
            if asset_record.application_id != application_id:
                raise InvalidAssetRecordReferenceError(
                    "Asset record belongs to a different application"
                )
