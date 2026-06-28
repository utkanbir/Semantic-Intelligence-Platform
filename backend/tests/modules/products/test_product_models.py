"""Tests for product domain + ORM models."""

import app.modules.applications.repositories.orm_models  # noqa: F401

from app.modules.products.repositories.orm_models import PublishedDataProduct


def test_published_data_product_requires_application_fk() -> None:
    table = PublishedDataProduct.__table__
    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "application_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "applications"
    assert table.columns["application_id"].nullable is False


def test_published_data_product_self_referential_version_fk() -> None:
    table = PublishedDataProduct.__table__
    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "previous_version_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "published_data_products"
    assert table.columns["previous_version_id"].nullable is True


def test_published_data_product_required_scalar_fields() -> None:
    table = PublishedDataProduct.__table__
    required_fields = {
        "version_number",
        "status",
        "title",
        "created_by",
        "created_at",
        "updated_at",
        "product_definition",
        "source_asset_record_ids",
    }
    for field in required_fields:
        assert table.columns[field].nullable is False
