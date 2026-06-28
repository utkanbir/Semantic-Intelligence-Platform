"""REST API routes for the products module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.assets.repositories.sqlalchemy_repository import SqlAlchemyAssetRecordRepository
from app.modules.products.api.schemas import (
    PublishedDataProductCreateRequest,
    PublishedDataProductResponse,
    PublishedDataProductStatusUpdateRequest,
    PublishedDataProductUpdateRequest,
    to_published_data_product_response,
)
from app.modules.products.domain.enums import PublishedDataProductStatus
from app.modules.products.repositories.sqlalchemy_repository import (
    SqlAlchemyPublishedDataProductRepository,
)
from app.modules.products.services.products_service import (
    UNSET,
    ApplicationNotFoundError,
    AssetRecordNotFoundError,
    ImmutablePublishedDataProductError,
    InvalidAssetRecordReferenceError,
    InvalidPublishedDataProductStatusTransitionError,
    ProductsService,
    PublishedDataProductNotFoundError,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


def _get_service(db: Session) -> ProductsService:
    return ProductsService(
        SqlAlchemyPublishedDataProductRepository(db),
        SqlAlchemyApplicationRepository(db),
        SqlAlchemyAssetRecordRepository(db),
    )


@router.post("", response_model=PublishedDataProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: PublishedDataProductCreateRequest, db: DbSession
) -> PublishedDataProductResponse:
    service = _get_service(db)
    try:
        product = service.create_product(
            application_id=payload.application_id,
            title=payload.title,
            created_by=payload.created_by,
            description=payload.description,
            product_definition=payload.product_definition,
            source_asset_record_ids=payload.source_asset_record_ids,
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except AssetRecordNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidAssetRecordReferenceError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_published_data_product_response(product)


@router.get("", response_model=list[PublishedDataProductResponse])
def list_products(
    db: DbSession,
    application_id: Annotated[UUID, Query()],
    product_status: Annotated[PublishedDataProductStatus | None, Query()] = None,
) -> list[PublishedDataProductResponse]:
    service = _get_service(db)
    try:
        products = service.list_products(application_id=application_id, status=product_status)
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return [to_published_data_product_response(product) for product in products]


@router.get("/{product_id}", response_model=PublishedDataProductResponse)
def get_product(product_id: UUID, db: DbSession) -> PublishedDataProductResponse:
    service = _get_service(db)
    try:
        product = service.get_product(product_id)
    except PublishedDataProductNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_published_data_product_response(product)


@router.patch("/{product_id}", response_model=PublishedDataProductResponse)
def update_product(
    product_id: UUID, payload: PublishedDataProductUpdateRequest, db: DbSession
) -> PublishedDataProductResponse:
    service = _get_service(db)
    provided_values = payload.model_dump(exclude_unset=True)
    try:
        product = service.update_product(
            product_id,
            title=provided_values.get("title"),
            description=provided_values.get("description", UNSET),
            product_definition=provided_values.get("product_definition", UNSET),
            source_asset_record_ids=provided_values.get("source_asset_record_ids", UNSET),
        )
    except PublishedDataProductNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ImmutablePublishedDataProductError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except AssetRecordNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidAssetRecordReferenceError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_published_data_product_response(product)


@router.patch("/{product_id}/status", response_model=PublishedDataProductResponse)
def update_product_status(
    product_id: UUID, payload: PublishedDataProductStatusUpdateRequest, db: DbSession
) -> PublishedDataProductResponse:
    service = _get_service(db)
    try:
        product = service.update_status(product_id, status=payload.status)
    except PublishedDataProductNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidPublishedDataProductStatusTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_published_data_product_response(product)
