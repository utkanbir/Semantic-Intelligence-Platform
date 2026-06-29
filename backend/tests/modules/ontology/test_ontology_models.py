"""Tests for ontology domain + ORM models."""

import app.modules.applications.repositories.orm_models  # noqa: F401
from app.modules.ontology.repositories.orm_models import OntologyDefinition


def test_ontology_definition_requires_application_fk() -> None:
    table = OntologyDefinition.__table__
    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "application_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "applications"


def test_ontology_definition_self_referential_version_fk() -> None:
    table = OntologyDefinition.__table__
    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "previous_version_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "ontology_definitions"
