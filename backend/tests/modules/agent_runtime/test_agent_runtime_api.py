"""API tests for agent run stub execution and D-003 enforcement."""

from __future__ import annotations

from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.agent_runtime.repositories.orm_models  # noqa: F401
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


def _create_application(client: TestClient) -> str:
    response = client.post(
        "/api/v1/applications",
        json={"key": f"runtime-api-{uuid4()}", "name": "Runtime API App"},
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


def _create_active_agent(
    client: TestClient, application_id: str, *, product_id: str | None = None
) -> str:
    payload: dict[str, object] = {
        "application_id": application_id,
        "title": "Runnable Agent",
    }
    if product_id is not None:
        payload["bound_product_ids"] = [product_id]

    response = client.post("/api/v1/agents", json=payload)
    assert response.status_code == 201
    agent_id = response.json()["id"]
    for next_status in ("Approved", "Active"):
        patch = client.patch(
            f"/api/v1/agents/{agent_id}/status",
            json={"status": next_status},
        )
        assert patch.status_code == 200
    return agent_id


def test_start_agent_run_stub(client: TestClient) -> None:
    application_id = _create_application(client)
    product_id = _create_published_product(client, application_id)
    agent_id = _create_active_agent(client, application_id, product_id=product_id)

    response = client.post(
        "/api/v1/agent-runs",
        json={
            "application_id": application_id,
            "agent_definition_id": agent_id,
            "run_payload": {"query": "hello"},
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "Completed"
    assert body["run_result"]["status"] == "stub_completed"
    assert body["run_result"]["echo"] == {"query": "hello"}


def test_start_agent_run_records_semantic_transaction(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    product_id = _create_published_product(client, application_id)
    agent_id = _create_active_agent(client, application_id, product_id=product_id)

    response = client.post(
        "/api/v1/agent-runs",
        json={
            "application_id": application_id,
            "agent_definition_id": agent_id,
        },
    )
    assert response.status_code == 201
    run_id = response.json()["id"]

    with Session(db_engine) as session:
        row = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.resource_id == run_id,
            )
        )
        assert row is not None
        assert row.transaction_type == "agent.run.started"


def test_start_agent_run_without_products_returns_422(client: TestClient) -> None:
    application_id = _create_application(client)
    agent_id = _create_active_agent(client, application_id)

    response = client.post(
        "/api/v1/agent-runs",
        json={
            "application_id": application_id,
            "agent_definition_id": agent_id,
        },
    )
    assert response.status_code == 422


def test_start_agent_run_draft_agent_returns_422(client: TestClient) -> None:
    application_id = _create_application(client)
    product_id = _create_published_product(client, application_id)
    create = client.post(
        "/api/v1/agents",
        json={
            "application_id": application_id,
            "title": "Draft Agent",
            "bound_product_ids": [product_id],
        },
    )
    agent_id = create.json()["id"]

    response = client.post(
        "/api/v1/agent-runs",
        json={
            "application_id": application_id,
            "agent_definition_id": agent_id,
        },
    )
    assert response.status_code == 422
