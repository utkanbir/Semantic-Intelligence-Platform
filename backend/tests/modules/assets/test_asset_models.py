"""Tests for asset domain + ORM models."""

from app.modules.assets.repositories.orm_models import AssetRecord


def test_asset_record_requires_application_fk() -> None:
    table = AssetRecord.__table__
    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "application_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "applications"
    assert table.columns["application_id"].nullable is False


def test_asset_record_unique_application_resource() -> None:
    table = AssetRecord.__table__
    unique = next(
        constraint
        for constraint in table.constraints
        if constraint.name == "uq_asset_records_application_resource"
    )
    column_names = {column.name for column in unique.columns}
    assert column_names == {"application_id", "resource_type", "resource_id"}


def test_asset_record_required_scalar_fields() -> None:
    table = AssetRecord.__table__
    required_fields = {
        "asset_type",
        "resource_type",
        "resource_id",
        "status",
        "title",
        "created_by",
        "created_at",
        "updated_at",
    }
    for field in required_fields:
        assert table.columns[field].nullable is False
