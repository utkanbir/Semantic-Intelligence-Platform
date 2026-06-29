"""Tests for agent domain + ORM models."""

import app.modules.applications.repositories.orm_models  # noqa: F401
from app.modules.agents.repositories.orm_models import AgentDefinition


def test_agent_definition_requires_application_fk() -> None:
    table = AgentDefinition.__table__
    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "application_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "applications"
    assert table.columns["application_id"].nullable is False


def test_agent_definition_self_referential_version_fk() -> None:
    table = AgentDefinition.__table__
    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "previous_version_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "agent_definitions"
    assert table.columns["previous_version_id"].nullable is True


def test_agent_definition_required_scalar_fields() -> None:
    table = AgentDefinition.__table__
    required_fields = {
        "version_number",
        "status",
        "title",
        "created_by",
        "created_at",
        "updated_at",
        "agent_definition",
        "bound_product_ids",
    }
    for field in required_fields:
        assert table.columns[field].nullable is False
