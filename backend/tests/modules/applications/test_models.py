"""Tests for applications domain + ORM models."""

from app.modules.applications.repositories.orm_models import Application, ApplicationWorkspace


def test_application_workspace_relationship_is_one_to_one() -> None:
    workspace_rel = Application.workspace.property
    application_rel = ApplicationWorkspace.application.property

    assert workspace_rel.uselist is False
    assert application_rel.uselist is False
    assert workspace_rel.back_populates == "application"
    assert application_rel.back_populates == "workspace"


def test_application_workspace_namespace_fields_are_required() -> None:
    table = ApplicationWorkspace.__table__
    required_namespace_fields = {
        "postgres_schema",
        "minio_namespace",
        "fuseki_dataset",
        "qdrant_collection",
        "metadata_domain",
        "ontology_namespace",
        "agent_namespace",
        "product_registry_namespace",
        "agent_registry_namespace",
    }

    for field in required_namespace_fields:
        assert table.columns[field].nullable is False


def test_application_workspace_requires_unique_application_id() -> None:
    table = ApplicationWorkspace.__table__

    assert table.columns["application_id"].nullable is False
    assert table.columns["application_id"].unique is True
