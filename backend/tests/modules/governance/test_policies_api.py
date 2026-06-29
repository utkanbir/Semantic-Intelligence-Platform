"""API tests for policy definition CRUD and lifecycle."""

from __future__ import annotations

from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.audit_trace.repositories.orm_models  # noqa: F401
import app.modules.governance.repositories.orm_models  # noqa: F401
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


def test_create_policy(client: TestClient) -> None:
    response = client.post(
        "/api/v1/policies",
        json={
            "policy_key": f"d003-{uuid4()}",
            "title": "D-003 Consumption Policy",
            "created_by": "architect-1",
        },
    )
    assert response.status_code == 201
    assert response.json()["status"] == "Draft"


def test_create_policy_records_semantic_transaction(
    client: TestClient, db_engine: Engine
) -> None:
    response = client.post(
        "/api/v1/policies",
        json={"policy_key": f"trace-{uuid4()}", "title": "Traced Policy"},
    )
    assert response.status_code == 201
    policy_id = response.json()["id"]

    with Session(db_engine) as session:
        row = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.resource_id == policy_id,
            )
        )
        assert row is not None
        assert row.transaction_type == "policy.created"


def test_policy_lifecycle(client: TestClient) -> None:
    create = client.post(
        "/api/v1/policies",
        json={"policy_key": f"lifecycle-{uuid4()}", "title": "Lifecycle Policy"},
    )
    policy_id = create.json()["id"]

    for next_status in ("Approved", "Active", "Retired"):
        patch = client.patch(
            f"/api/v1/policies/{policy_id}/status",
            json={"status": next_status},
        )
        assert patch.status_code == 200
        assert patch.json()["status"] == next_status


def test_update_retired_policy_returns_422(client: TestClient) -> None:
    create = client.post(
        "/api/v1/policies",
        json={"policy_key": f"retired-{uuid4()}", "title": "Retired Policy"},
    )
    policy_id = create.json()["id"]
    for next_status in ("Approved", "Active", "Retired"):
        client.patch(
            f"/api/v1/policies/{policy_id}/status",
            json={"status": next_status},
        )

    patch = client.patch(
        f"/api/v1/policies/{policy_id}",
        json={"title": "Cannot Update"},
    )
    assert patch.status_code == 422
