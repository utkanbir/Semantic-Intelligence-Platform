"""API tests for ontology definition CRUD, lifecycle, and versioning."""

from __future__ import annotations

from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.applications.repositories.orm_models  # noqa: F401
import app.modules.audit_trace.repositories.orm_models  # noqa: F401
import app.modules.ontology.repositories.orm_models  # noqa: F401
from app.infrastructure.database import get_db
from app.main import app as fastapi_app
from app.modules.applications.repositories.orm_models import Base
from app.modules.audit_trace.repositories.orm_models import SemanticTransaction


@pytest.fixture()
def db_engine() -> Generator[Engine, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_engine: Engine) -> Generator[TestClient, None, None]:
    testing_session_local = sessionmaker(
        bind=db_engine,
        autoflush=False,
        autocommit=False,
        class_=Session,
    )

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


def _create_application(client: TestClient) -> str:
    response = client.post(
        "/api/v1/applications",
        json={"key": f"ontology-api-{uuid4()}", "name": "Ontology API App"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_ontology(client: TestClient) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/ontologies",
        json={
            "application_id": application_id,
            "title": "Vendor Ontology",
            "ontology_definition": {"classes": [{"name": "Vendor"}]},
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "Draft"
    assert body["ontology_definition"]["classes"][0]["name"] == "Vendor"


def test_create_ontology_records_semantic_transaction(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Traced Ontology"},
    )
    assert response.status_code == 201
    ontology_id = response.json()["id"]

    with Session(db_engine) as session:
        row = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.resource_id == ontology_id,
            )
        )
        assert row is not None
        assert row.transaction_type == "ontology.created"
        assert row.resource_type == "OntologyDefinition"


def test_patch_status_full_lifecycle(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Lifecycle Ontology"},
    )
    ontology_id = create.json()["id"]
    for next_status in ("Validated", "Approved", "Published", "Versioned", "Retired"):
        response = client.patch(
            f"/api/v1/ontologies/{ontology_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200


def test_create_version_from_published(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Versioned Ontology"},
    )
    ontology_id = create.json()["id"]
    for next_status in ("Validated", "Approved", "Published"):
        client.patch(
            f"/api/v1/ontologies/{ontology_id}/status",
            json={"status": next_status},
        )

    version = client.post(f"/api/v1/ontologies/{ontology_id}/versions", json={})
    assert version.status_code == 201
    body = version.json()
    assert body["version_number"] == 2
    assert body["status"] == "Draft"
    assert body["previous_version_id"] == ontology_id


def test_patch_status_invalid_transition_returns_422(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Invalid Transition"},
    )
    ontology_id = create.json()["id"]
    response = client.patch(
        f"/api/v1/ontologies/{ontology_id}/status",
        json={"status": "Published"},
    )
    assert response.status_code == 422
