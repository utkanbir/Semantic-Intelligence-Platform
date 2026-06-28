"""API tests for applications CRUD and blank workspace provisioning."""

from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.infrastructure.database import get_db
from app.main import app
from app.modules.applications.repositories.orm_models import Base


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        class_=Session,
    )
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def test_create_application_provisions_blank_workspace(client: TestClient) -> None:
    response = client.post(
        "/api/v1/applications",
        json={
            "key": "acme-assessment",
            "name": "Acme Assessment",
            "description": "Initial app",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["key"] == "acme-assessment"
    assert body["workspace"]["status"] == "provisioned"
    assert body["workspace"]["postgres_schema"] == "sip_acme_assessment"
    assert body["workspace"]["minio_namespace"] == "sip-acme-assessment"
    assert body["workspace"]["fuseki_dataset"] == "sip/acme-assessment"
    assert body["workspace"]["qdrant_collection"] == "sip_acme_assessment"
    assert body["workspace"]["metadata_domain"] == "sip-acme-assessment"
    assert body["workspace"]["ontology_namespace"] == "sip.acme-assessment.ontology"
    assert body["workspace"]["agent_namespace"] == "sip.acme-assessment.agents"
    assert body["workspace"]["product_registry_namespace"] == "sip.acme-assessment.products"
    assert body["workspace"]["agent_registry_namespace"] == "sip.acme-assessment.agent-runtime"


def test_create_application_returns_409_for_duplicate_key(client: TestClient) -> None:
    payload = {"key": "duplicate-key", "name": "First App"}

    first = client.post("/api/v1/applications", json=payload)
    second = client.post("/api/v1/applications", json=payload)

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "Application key already exists"


def test_list_get_update_delete_application(client: TestClient) -> None:
    created = client.post(
        "/api/v1/applications",
        json={"key": "alpha-app", "name": "Alpha App", "description": "v1"},
    )
    assert created.status_code == 201
    created_body = created.json()
    application_id = created_body["id"]

    listed = client.get("/api/v1/applications")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    got = client.get(f"/api/v1/applications/{application_id}")
    assert got.status_code == 200
    assert got.json()["name"] == "Alpha App"

    updated = client.put(
        f"/api/v1/applications/{application_id}",
        json={"key": "alpha-next", "name": "Alpha Next", "description": "v2"},
    )
    assert updated.status_code == 200
    updated_body = updated.json()
    assert updated_body["key"] == "alpha-next"
    assert updated_body["name"] == "Alpha Next"
    assert updated_body["description"] == "v2"
    assert updated_body["workspace"]["postgres_schema"] == "sip_alpha_next"
    assert updated_body["workspace"]["agent_namespace"] == "sip.alpha-next.agents"

    deleted = client.delete(f"/api/v1/applications/{application_id}")
    assert deleted.status_code == 204

    missing = client.get(f"/api/v1/applications/{application_id}")
    assert missing.status_code == 404
