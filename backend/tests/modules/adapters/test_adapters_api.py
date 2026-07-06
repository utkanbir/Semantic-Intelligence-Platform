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
        "/api/v1/connectors",
        json={
            "connector_type": "database",
            "connector_key": f"dev-db-{uuid4()}",
            "title": "Dev Database",
            "created_by": "architect-1",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "Active"
    assert body["connector_type"] == "database"


def test_create_adapter_records_semantic_transaction(
    client: TestClient, db_engine: Engine
) -> None:
    response = client.post(
        "/api/v1/connectors",
        json={
            "connector_type": "object_storage",
            "connector_key": f"dev-storage-{uuid4()}",
            "title": "Dev Object Storage",
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
        "/api/v1/connectors",
        json={
            "connector_type": "database",
            "connector_key": f"dev-db-ping-{uuid4()}",
            "title": "Ping Connector",
        },
    )
    adapter_id = create.json()["id"]
    assert create.json()["status"] == "Active"

    ping = client.post(f"/api/v1/connectors/{adapter_id}/ping")
    assert ping.status_code == 200
    assert ping.json()["status"] == "ok"
    assert ping.json()["connector_type"] == "database"

    patch = client.patch(
        f"/api/v1/connectors/{adapter_id}/status",
        json={"status": "Deprecated"},
    )
    assert patch.status_code == 200

    ping_after_deprecate = client.post(f"/api/v1/connectors/{adapter_id}/ping")
    assert ping_after_deprecate.status_code == 422


def test_duplicate_adapter_key_returns_422(client: TestClient) -> None:
    adapter_key = f"dup-key-{uuid4()}"
    first = client.post(
        "/api/v1/connectors",
        json={
            "connector_type": "database",
            "connector_key": adapter_key,
            "title": "First",
        },
    )
    assert first.status_code == 201

    second = client.post(
        "/api/v1/connectors",
        json={
            "connector_type": "database",
            "connector_key": adapter_key,
            "title": "Second",
        },
    )
    assert second.status_code == 422


def test_create_adapter_auto_generates_connector_key(client: TestClient) -> None:
    response = client.post(
        "/api/v1/connectors",
        json={
            "connector_type": "database",
            "title": "Dev PostgreSQL",
            "connector_configuration": {
                "schema_version": "2",
                "vendor": "postgresql",
                "connection_method": "existing_instance",
                "connection": {},
            },
        },
    )
    assert response.status_code == 201
    assert response.json()["connector_key"] == "dev-postgresql"


def test_create_adapter_auto_key_collision_appends_suffix(client: TestClient) -> None:
    first = client.post(
        "/api/v1/connectors",
        json={
            "connector_type": "database",
            "connector_key": "dev-postgresql",
            "title": "Existing",
        },
    )
    assert first.status_code == 201

    second = client.post(
        "/api/v1/connectors",
        json={
            "connector_type": "database",
            "title": "Dev PostgreSQL",
            "connector_configuration": {
                "schema_version": "2",
                "vendor": "postgresql",
            },
        },
    )
    assert second.status_code == 201
    assert second.json()["connector_key"] == "dev-postgresql-2"


def test_create_vector_database_connector_and_ping(client: TestClient) -> None:
    create = client.post(
        "/api/v1/connectors",
        json={
            "connector_type": "vector_database",
            "connector_key": f"dev-vector-{uuid4()}",
            "title": "Dev Vector Store",
            "connector_configuration": {
                "schema_version": "2",
                "vendor": "qdrant",
                "connection_method": "existing_instance",
                "connection": {"host": "qdrant.local", "port": "6333", "collection": "embeddings"},
            },
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert body["connector_type"] == "vector_database"
    assert body["status"] == "Active"
    adapter_id = body["id"]

    ping = client.post(f"/api/v1/connectors/{adapter_id}/ping")
    assert ping.status_code == 200
    assert ping.json() == {"status": "ok", "connector_type": "vector_database"}


def test_test_connector_configuration(client: TestClient) -> None:
    response = client.post(
        "/api/v1/connectors/test",
        json={
            "connector_type": "vector_database",
            "connector_configuration": {
                "schema_version": "2",
                "vendor": "qdrant",
                "connection_method": "existing_instance",
                "connection": {"host": "qdrant.local", "port": "6333", "collection": "embeddings"},
            },
        },
    )
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "connector_type": "vector_database"}


def test_test_connector_configuration_rejects_invalid_fuseki_endpoint(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/connectors/test",
        json={
            "connector_type": "ontology_knowledge_graph",
            "connector_configuration": {
                "schema_version": "2",
                "vendor": "apache_fuseki",
                "connection_method": "existing_instance",
                "connection": {},
            },
        },
    )
    assert response.status_code == 422
    assert "endpoint" in response.json()["detail"].lower()


def test_create_adapter_accepts_explicit_connector_key(client: TestClient) -> None:
    explicit_key = f"custom-key-{uuid4()}"
    response = client.post(
        "/api/v1/connectors",
        json={
            "connector_type": "database",
            "connector_key": explicit_key,
            "title": "Dev PostgreSQL",
            "connector_configuration": {
                "schema_version": "2",
                "vendor": "postgresql",
            },
        },
    )
    assert response.status_code == 201
    assert response.json()["connector_key"] == explicit_key

