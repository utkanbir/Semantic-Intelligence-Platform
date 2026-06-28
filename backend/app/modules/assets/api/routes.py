"""REST API routes for the assets module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.assets.api.schemas import (
    AssetRecordCreateRequest,
    AssetRecordResponse,
    AssetRecordUpdateRequest,
    to_asset_record_response,
)
from app.modules.assets.domain.enums import AssetType
from app.modules.assets.repositories.sqlalchemy_repository import (
    SqlAlchemyAssetRecordRepository,
)
from app.modules.assets.services.assets_service import (
    UNSET,
    ApplicationNotFoundError,
    AssetRecordNotFoundError,
    AssetsService,
    DuplicateAssetRecordConflictError,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


def _get_service(db: Session) -> AssetsService:
    return AssetsService(
        SqlAlchemyAssetRecordRepository(db),
        SqlAlchemyApplicationRepository(db),
    )


@router.post("", response_model=AssetRecordResponse, status_code=status.HTTP_201_CREATED)
def create_asset_record(payload: AssetRecordCreateRequest, db: DbSession) -> AssetRecordResponse:
    service = _get_service(db)
    try:
        asset_record = service.create_asset_record(
            application_id=payload.application_id,
            asset_type=payload.asset_type,
            resource_type=payload.resource_type,
            resource_id=payload.resource_id,
            title=payload.title,
            created_by=payload.created_by,
            description=payload.description,
            metadata=payload.metadata,
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except DuplicateAssetRecordConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    return to_asset_record_response(asset_record)


@router.get("", response_model=list[AssetRecordResponse])
def list_asset_records(
    db: DbSession,
    application_id: Annotated[UUID, Query()],
    asset_type: Annotated[AssetType | None, Query()] = None,
) -> list[AssetRecordResponse]:
    service = _get_service(db)
    try:
        asset_records = service.list_asset_records(
            application_id=application_id,
            asset_type=asset_type,
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return [to_asset_record_response(asset_record) for asset_record in asset_records]


@router.get("/{asset_record_id}", response_model=AssetRecordResponse)
def get_asset_record(asset_record_id: UUID, db: DbSession) -> AssetRecordResponse:
    service = _get_service(db)
    try:
        asset_record = service.get_asset_record(asset_record_id)
    except AssetRecordNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_asset_record_response(asset_record)


@router.patch("/{asset_record_id}", response_model=AssetRecordResponse)
def update_asset_record(
    asset_record_id: UUID, payload: AssetRecordUpdateRequest, db: DbSession
) -> AssetRecordResponse:
    service = _get_service(db)
    provided_values = payload.model_dump(exclude_unset=True)
    try:
        asset_record = service.update_asset_record(
            asset_record_id,
            title=provided_values.get("title"),
            description=provided_values.get("description", UNSET),
            metadata=provided_values.get("metadata", UNSET),
        )
    except AssetRecordNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_asset_record_response(asset_record)
