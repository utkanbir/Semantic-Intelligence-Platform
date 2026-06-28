"""SQLAlchemy repository implementations for the assets module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.assets.domain.enums import AssetRecordStatus, AssetType
from app.modules.assets.domain.models import AssetRecord
from app.modules.assets.repositories.interfaces import (
    AssetRecordRepository,
    DuplicateAssetRecordError,
)
from app.modules.assets.repositories.orm_models import AssetRecord as AssetRecordORM


def _to_domain(asset_record_orm: AssetRecordORM) -> AssetRecord:
    return AssetRecord(
        id=asset_record_orm.id,
        application_id=asset_record_orm.application_id,
        asset_type=AssetType(asset_record_orm.asset_type),
        resource_type=asset_record_orm.resource_type,
        resource_id=asset_record_orm.resource_id,
        status=AssetRecordStatus(asset_record_orm.status),
        title=asset_record_orm.title,
        description=asset_record_orm.description,
        created_by=asset_record_orm.created_by,
        created_at=asset_record_orm.created_at,
        updated_at=asset_record_orm.updated_at,
        metadata=asset_record_orm.metadata_json,
    )


class SqlAlchemyAssetRecordRepository(AssetRecordRepository):
    """SQLAlchemy-backed implementation for asset registry persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, asset_record: AssetRecord) -> AssetRecord:
        asset_record_orm = AssetRecordORM(
            id=asset_record.id,
            application_id=asset_record.application_id,
            asset_type=asset_record.asset_type.value,
            resource_type=asset_record.resource_type,
            resource_id=asset_record.resource_id,
            status=asset_record.status.value,
            title=asset_record.title,
            description=asset_record.description,
            created_by=asset_record.created_by,
            created_at=asset_record.created_at,
            updated_at=asset_record.updated_at,
            metadata_json=asset_record.metadata,
        )
        self._session.add(asset_record_orm)
        try:
            self._session.commit()
        except IntegrityError as error:
            self._session.rollback()
            raise DuplicateAssetRecordError("Asset record already exists for resource") from error
        self._session.refresh(asset_record_orm)
        return _to_domain(asset_record_orm)

    def list_by_application(
        self,
        application_id: UUID,
        *,
        asset_type: str | None = None,
    ) -> Sequence[AssetRecord]:
        statement = (
            select(AssetRecordORM)
            .where(AssetRecordORM.application_id == application_id)
            .order_by(AssetRecordORM.created_at.desc())
        )
        if asset_type is not None:
            statement = statement.where(AssetRecordORM.asset_type == asset_type)
        return [_to_domain(item) for item in self._session.scalars(statement).all()]

    def get(self, asset_record_id: UUID) -> AssetRecord | None:
        asset_record_orm = self._session.get(AssetRecordORM, asset_record_id)
        return _to_domain(asset_record_orm) if asset_record_orm else None

    def update(self, asset_record: AssetRecord) -> AssetRecord | None:
        asset_record_orm = self._session.get(AssetRecordORM, asset_record.id)
        if asset_record_orm is None:
            return None

        asset_record_orm.status = asset_record.status.value
        asset_record_orm.title = asset_record.title
        asset_record_orm.description = asset_record.description
        asset_record_orm.updated_at = asset_record.updated_at
        asset_record_orm.metadata_json = asset_record.metadata

        self._session.commit()
        self._session.refresh(asset_record_orm)
        return _to_domain(asset_record_orm)
