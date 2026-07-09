"""API tests for knowledge graph registry CRUD and lifecycle."""

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
import app.modules.knowledge_graph.repositories.orm_models  # noqa: F401
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
        json={"key": f"kg-api-{uuid4()}", "name": "KG API App"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_published_ontology(client: TestClient, application_id: str) -> str:
    response = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Bindable Ontology"},
    )
    assert response.status_code == 201
    ontology_id = response.json()["id"]
    for next_status in ("Validated", "Approved"):
        patch = client.patch(
            f"/api/v1/ontologies/{ontology_id}/status",
            json={"status": next_status},
        )
        assert patch.status_code == 200
    return ontology_id


def test_create_knowledge_graph(client: TestClient) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/knowledge-graphs",
        json={"application_id": application_id, "title": "Vendor KG"},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "Created"


def test_create_knowledge_graph_records_semantic_transaction(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/knowledge-graphs",
        json={"application_id": application_id, "title": "Traced KG"},
    )
    assert response.status_code == 201
    registry_id = response.json()["id"]

    with Session(db_engine) as session:
        row = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.resource_id == registry_id,
            )
        )
        assert row is not None
        assert row.transaction_type == "knowledge_graph.created"


def test_create_with_bound_ontology(client: TestClient) -> None:
    application_id = _create_application(client)
    ontology_id = _create_published_ontology(client, application_id)
    response = client.post(
        "/api/v1/knowledge-graphs",
        json={
            "application_id": application_id,
            "title": "Bound KG",
            "bound_ontology_ids": [ontology_id],
        },
    )
    assert response.status_code == 201
    assert response.json()["bound_ontology_ids"] == [ontology_id]


def test_rejects_draft_ontology_binding(client: TestClient) -> None:
    application_id = _create_application(client)
    draft = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Draft Ontology"},
    ).json()["id"]
    response = client.post(
        "/api/v1/knowledge-graphs",
        json={
            "application_id": application_id,
            "title": "Invalid KG",
            "bound_ontology_ids": [draft],
        },
    )
    assert response.status_code == 422


def test_patch_status_lifecycle(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/knowledge-graphs",
        json={"application_id": application_id, "title": "Lifecycle KG"},
    )
    registry_id = create.json()["id"]
    for next_status in ("Populated", "Updated", "Archived"):
        response = client.patch(
            f"/api/v1/knowledge-graphs/{registry_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200


def test_patch_status_invalid_transition(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/knowledge-graphs",
        json={"application_id": application_id, "title": "Invalid Transition"},
    )
    registry_id = create.json()["id"]
    response = client.patch(
        f"/api/v1/knowledge-graphs/{registry_id}/status",
        json={"status": "Archived"},
    )
    assert response.status_code == 422
