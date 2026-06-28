"""Tests for blueprint domain + ORM models."""

from app.modules.blueprints.repositories.orm_models import Blueprint


def test_blueprint_requires_application_fk() -> None:
    table = Blueprint.__table__
    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "application_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "applications"
    assert table.columns["application_id"].nullable is False


def test_blueprint_self_referential_version_fk() -> None:
    table = Blueprint.__table__
    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "previous_version_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "blueprints"
    assert table.columns["previous_version_id"].nullable is True


def test_blueprint_required_scalar_fields() -> None:
    table = Blueprint.__table__
    required_fields = {
        "version_number",
        "status",
        "title",
        "created_by",
        "created_at",
        "blueprint_snapshot",
    }
    for field in required_fields:
        assert table.columns[field].nullable is False
