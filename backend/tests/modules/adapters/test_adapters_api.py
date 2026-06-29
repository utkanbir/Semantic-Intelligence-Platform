"""API tests for technology adapter CRUD, lifecycle, and ping."""

from __future__ import annotations

from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.adapters.repositories.orm_models  # noqa: F401
import app.modules.audit_trace.repositories.orm_models  # noqa: F401
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


def test_create_adapter(client: TestClient) -> None:
    response = client.post(
        "/api/v1/adapters",
        json={
            "technology_type": "postgresql",
            "adapter_key": f"dev-pg-{uuid4()}",
            "title": "Dev PostgreSQL",
            "created_by": "architect-1",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "Registered"
    assert body["technology_type"] == "postgresql"


def test_create_adapter_records_semantic_transaction(
    client: TestClient, db_engine: Engine
) -> None:
    response = client.post(
        "/api/v1/adapters",
        json={
            "technology_type": "minio",
            "adapter_key": f"dev-minio-{uuid4()}",
            "title": "Dev MinIO",
        },
    )
    assert response.status_code == 201
    adapter_id = response.json()["id"]

    with Session(db_engine) as session:
        row = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.resource_id == adapter_id,
            )
        )
        assert row is not None
        assert row.transaction_type == "adapter.registered"


def test_adapter_lifecycle_and_ping(client: TestClient) -> None:
    create = client.post(
        "/api/v1/adapters",
        json={
            "technology_type": "postgresql",
            "adapter_key": f"dev-pg-ping-{uuid4()}",
            "title": "Ping Adapter",
        },
    )
    adapter_id = create.json()["id"]

    ping_before_active = client.post(f"/api/v1/adapters/{adapter_id}/ping")
    assert ping_before_active.status_code == 422

    for next_status in ("Configured", "Active"):
        patch = client.patch(
            f"/api/v1/adapters/{adapter_id}/status",
            json={"status": next_status},
        )
        assert patch.status_code == 200

    ping = client.post(f"/api/v1/adapters/{adapter_id}/ping")
    assert ping.status_code == 200
    assert ping.json()["status"] == "ok"
    assert ping.json()["technology"] == "postgresql"


def test_duplicate_adapter_key_returns_422(client: TestClient) -> None:
    adapter_key = f"dup-key-{uuid4()}"
    first = client.post(
        "/api/v1/adapters",
        json={
            "technology_type": "fuseki",
            "adapter_key": adapter_key,
            "title": "First",
        },
    )
    assert first.status_code == 201

    second = client.post(
        "/api/v1/adapters",
        json={
            "technology_type": "fuseki",
            "adapter_key": adapter_key,
            "title": "Second",
        },
    )
    assert second.status_code == 422
