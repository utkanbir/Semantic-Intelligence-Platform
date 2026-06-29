"""API tests for agent definition CRUD, lifecycle, and versioning."""

from __future__ import annotations

from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.agents.repositories.orm_models  # noqa: F401
import app.modules.applications.repositories.orm_models  # noqa: F401
import app.modules.audit_trace.repositories.orm_models  # noqa: F401
import app.modules.products.repositories.orm_models  # noqa: F401
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


def _create_application(client: TestClient, *, key: str | None = None) -> str:
    response = client.post(
        "/api/v1/applications",
        json={
            "key": key or f"agent-api-app-{uuid4()}",
            "name": "Agent API App",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_published_product(client: TestClient, application_id: str) -> str:
    response = client.post(
        "/api/v1/products",
        json={"application_id": application_id, "title": "Consumable Product"},
    )
    assert response.status_code == 201
    product_id = response.json()["id"]
    for next_status in ("Certified", "Published"):
        patch = client.patch(
            f"/api/v1/products/{product_id}/status",
            json={"status": next_status},
        )
        assert patch.status_code == 200
    return product_id


def test_create_agent(client: TestClient) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/agents",
        json={
            "application_id": application_id,
            "title": "Vendor Analyst",
            "created_by": "architect-1",
            "agent_definition": {"persona": "Analyst", "instructions": "Summarize"},
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["application_id"] == application_id
    assert body["status"] == "Draft"
    assert body["version_number"] == 1
    assert body["agent_definition"]["persona"] == "Analyst"


def test_create_agent_records_semantic_transaction(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/agents",
        json={"application_id": application_id, "title": "Traced Agent"},
    )
    assert response.status_code == 201
    agent_id = response.json()["id"]

    with Session(db_engine) as session:
        row = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.resource_id == agent_id,
            )
        )
        assert row is not None
        assert row.transaction_type == "agent.created"
        assert row.resource_type == "AgentDefinition"


def test_create_agent_with_bound_product(client: TestClient) -> None:
    application_id = _create_application(client)
    product_id = _create_published_product(client, application_id)
    response = client.post(
        "/api/v1/agents",
        json={
            "application_id": application_id,
            "title": "Bound Agent",
            "bound_product_ids": [product_id],
        },
    )
    assert response.status_code == 201
    assert response.json()["bound_product_ids"] == [product_id]


def test_create_agent_rejects_draft_product_binding(client: TestClient) -> None:
    application_id = _create_application(client)
    draft_product = client.post(
        "/api/v1/products",
        json={"application_id": application_id, "title": "Draft Product"},
    ).json()["id"]

    response = client.post(
        "/api/v1/agents",
        json={
            "application_id": application_id,
            "title": "Invalid Binding",
            "bound_product_ids": [draft_product],
        },
    )
    assert response.status_code == 422


def test_create_agent_returns_404_for_unknown_application(client: TestClient) -> None:
    response = client.post(
        "/api/v1/agents",
        json={
            "application_id": str(uuid4()),
            "title": "Orphan Agent",
        },
    )
    assert response.status_code == 404


def test_list_and_get_agents(client: TestClient) -> None:
    application_id = _create_application(client)
    create_response = client.post(
        "/api/v1/agents",
        json={"application_id": application_id, "title": "Listed Agent"},
    )
    agent_id = create_response.json()["id"]

    list_response = client.get("/api/v1/agents", params={"application_id": application_id})
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = client.get(f"/api/v1/agents/{agent_id}")
    assert get_response.status_code == 200
    assert get_response.json()["title"] == "Listed Agent"


def test_update_agent(client: TestClient) -> None:
    application_id = _create_application(client)
    create_response = client.post(
        "/api/v1/agents",
        json={"application_id": application_id, "title": "Original Title"},
    )
    agent_id = create_response.json()["id"]

    patch_response = client.patch(
        f"/api/v1/agents/{agent_id}",
        json={"title": "Updated Title", "description": "Updated description"},
    )
    assert patch_response.status_code == 200
    body = patch_response.json()
    assert body["title"] == "Updated Title"
    assert body["description"] == "Updated description"


def test_update_agent_returns_422_for_foreign_product(client: TestClient) -> None:
    application_id = _create_application(client)
    other_application_id = _create_application(client)
    foreign_product_id = _create_published_product(client, other_application_id)

    create_response = client.post(
        "/api/v1/agents",
        json={"application_id": application_id, "title": "Scoped Agent"},
    )
    agent_id = create_response.json()["id"]

    patch_response = client.patch(
        f"/api/v1/agents/{agent_id}",
        json={"bound_product_ids": [foreign_product_id]},
    )
    assert patch_response.status_code == 422


def _create_agent(client: TestClient, application_id: str) -> str:
    response = client.post(
        "/api/v1/agents",
        json={"application_id": application_id, "title": "Lifecycle Agent"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_patch_status_draft_to_approved_to_active(client: TestClient) -> None:
    application_id = _create_application(client)
    agent_id = _create_agent(client, application_id)

    approved = client.patch(
        f"/api/v1/agents/{agent_id}/status",
        json={"status": "Approved"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "Approved"
    assert approved.json()["approved_at"] is not None

    active = client.patch(
        f"/api/v1/agents/{agent_id}/status",
        json={"status": "Active"},
    )
    assert active.status_code == 200
    assert active.json()["status"] == "Active"
    assert active.json()["activated_at"] is not None


def test_patch_status_approved_back_to_draft(client: TestClient) -> None:
    application_id = _create_application(client)
    agent_id = _create_agent(client, application_id)
    client.patch(f"/api/v1/agents/{agent_id}/status", json={"status": "Approved"})

    draft = client.patch(
        f"/api/v1/agents/{agent_id}/status",
        json={"status": "Draft"},
    )
    assert draft.status_code == 200
    assert draft.json()["status"] == "Draft"


def test_patch_status_invalid_transition_returns_422(client: TestClient) -> None:
    application_id = _create_application(client)
    agent_id = _create_agent(client, application_id)

    response = client.patch(
        f"/api/v1/agents/{agent_id}/status",
        json={"status": "Active"},
    )
    assert response.status_code == 422


def test_patch_status_full_lifecycle_to_retired(client: TestClient) -> None:
    application_id = _create_application(client)
    agent_id = _create_agent(client, application_id)
    for next_status in ("Approved", "Active", "Versioned", "Retired"):
        response = client.patch(
            f"/api/v1/agents/{agent_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200

    blocked = client.patch(
        f"/api/v1/agents/{agent_id}/status",
        json={"status": "Draft"},
    )
    assert blocked.status_code == 422


def _advance_to_active(client: TestClient, agent_id: str) -> None:
    for next_status in ("Approved", "Active"):
        response = client.patch(
            f"/api/v1/agents/{agent_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200


def test_create_version_from_active_copies_definition(client: TestClient) -> None:
    application_id = _create_application(client)
    agent_id = _create_agent(client, application_id)
    client.patch(
        f"/api/v1/agents/{agent_id}",
        json={"agent_definition": {"persona": "Analyst", "instructions": "Analyze"}},
    )
    _advance_to_active(client, agent_id)

    parent_before = client.get(f"/api/v1/agents/{agent_id}").json()

    version = client.post(f"/api/v1/agents/{agent_id}/versions", json={})
    assert version.status_code == 201
    body = version.json()
    assert body["id"] != agent_id
    assert body["status"] == "Draft"
    assert body["version_number"] == 2
    assert body["previous_version_id"] == agent_id
    assert body["version_created_at"] is not None
    assert body["agent_definition"] == {"persona": "Analyst", "instructions": "Analyze"}

    parent_after = client.get(f"/api/v1/agents/{agent_id}").json()
    assert parent_after == parent_before


def test_create_version_with_custom_definition(client: TestClient) -> None:
    application_id = _create_application(client)
    agent_id = _create_agent(client, application_id)
    _advance_to_active(client, agent_id)

    version = client.post(
        f"/api/v1/agents/{agent_id}/versions",
        json={"agent_definition": {"persona": "Reviewer", "instructions": "Review"}},
    )
    assert version.status_code == 201
    assert version.json()["agent_definition"] == {
        "persona": "Reviewer",
        "instructions": "Review",
    }


def test_create_version_from_versioned_parent(client: TestClient) -> None:
    application_id = _create_application(client)
    agent_id = _create_agent(client, application_id)
    for next_status in ("Approved", "Active", "Versioned"):
        client.patch(
            f"/api/v1/agents/{agent_id}/status",
            json={"status": next_status},
        )

    version = client.post(f"/api/v1/agents/{agent_id}/versions", json={})
    assert version.status_code == 201
    assert version.json()["version_number"] == 2


def test_create_version_rejects_draft_parent(client: TestClient) -> None:
    application_id = _create_application(client)
    agent_id = _create_agent(client, application_id)

    response = client.post(f"/api/v1/agents/{agent_id}/versions", json={})
    assert response.status_code == 422
