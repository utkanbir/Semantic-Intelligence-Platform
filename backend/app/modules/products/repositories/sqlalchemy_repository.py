"""SQLAlchemy repository implementations for the products module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.products.domain.enums import PublishedDataProductStatus
from app.modules.products.domain.models import PublishedDataProduct
from app.modules.products.repositories.interfaces import PublishedDataProductRepository
from app.modules.products.repositories.orm_models import (
    PublishedDataProduct as PublishedDataProductORM,
)


def _to_domain(product_orm: PublishedDataProductORM) -> PublishedDataProduct:
    return PublishedDataProduct(
        id=product_orm.id,
        application_id=product_orm.application_id,
        version_number=product_orm.version_number,
        previous_version_id=product_orm.previous_version_id,
        status=PublishedDataProductStatus(product_orm.status),
        title=product_orm.title,
        description=product_orm.description,
        created_by=product_orm.created_by,
        created_at=product_orm.created_at,
        updated_at=product_orm.updated_at,
        certified_at=product_orm.certified_at,
        published_at=product_orm.published_at,
        version_created_at=product_orm.version_created_at,
        product_definition=product_orm.product_definition or {},
        source_asset_record_ids=list(product_orm.source_asset_record_ids or []),
    )


class SqlAlchemyPublishedDataProductRepository(PublishedDataProductRepository):
    """SQLAlchemy-backed implementation for product persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, product: PublishedDataProduct) -> PublishedDataProduct:
        product_orm = PublishedDataProductORM(
            id=product.id,
            application_id=product.application_id,
            version_number=product.version_number,
            previous_version_id=product.previous_version_id,
            status=product.status.value,
            title=product.title,
            description=product.description,
            created_by=product.created_by,
            created_at=product.created_at,
            updated_at=product.updated_at,
            certified_at=product.certified_at,
            published_at=product.published_at,
            version_created_at=product.version_created_at,
            product_definition=product.product_definition,
            source_asset_record_ids=product.source_asset_record_ids,
        )
        self._session.add(product_orm)
        self._session.commit()
        self._session.refresh(product_orm)
        return _to_domain(product_orm)

    def list_by_application(
        self,
        application_id: UUID,
        *,
        status: str | None = None,
    ) -> Sequence[PublishedDataProduct]:
        statement = (
            select(PublishedDataProductORM)
            .where(PublishedDataProductORM.application_id == application_id)
            .order_by(PublishedDataProductORM.version_number.desc())
        )
        if status is not None:
            statement = statement.where(PublishedDataProductORM.status == status)
        return [_to_domain(item) for item in self._session.scalars(statement).all()]

    def get(self, product_id: UUID) -> PublishedDataProduct | None:
        product_orm = self._session.get(PublishedDataProductORM, product_id)
        return _to_domain(product_orm) if product_orm else None

    def update(self, product: PublishedDataProduct) -> PublishedDataProduct | None:
        product_orm = self._session.get(PublishedDataProductORM, product.id)
        if product_orm is None:
            return None

        product_orm.status = product.status.value
        product_orm.title = product.title
        product_orm.description = product.description
        product_orm.updated_at = product.updated_at
        product_orm.certified_at = product.certified_at
        product_orm.published_at = product.published_at
        product_orm.version_created_at = product.version_created_at
        product_orm.product_definition = product.product_definition
        product_orm.source_asset_record_ids = product.source_asset_record_ids

        self._session.commit()
        self._session.refresh(product_orm)
        return _to_domain(product_orm)
