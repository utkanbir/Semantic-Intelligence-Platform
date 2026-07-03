"""API tests for connector in-cluster provision orchestration."""

from __future__ import annotations

from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.adapters.repositories.orm_models  # noqa: F401
import app.modules.audit_trace.repositories.orm_models  # noqa: F401
from app.infrastructure.database import get_db
from app.main import app as fastapi_app
from app.modules.applications.repositories.orm_models import Base
from app.modules.audit_trace.repositories.orm_models import SemanticTransaction, TraceStep


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


def _create_connector(
    client: TestClient,
    *,
    connector_type: str,
    vendor: str,
    connection_method: str,
    connector_key: str | None = None,
) -> str:
    response = client.post(
        "/api/v1/connectors",
        json={
            "connector_type": connector_type,
            "connector_key": connector_key or f"connector-{uuid4()}",
            "title": f"Provision test {vendor}",
            "connector_configuration": {
                "schema_version": "2",
                "vendor": vendor,
                "connection_method": connection_method,
                "connection": {},
            },
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_provision_minio_connector_happy_path(client: TestClient, db_engine: Engine) -> None:
    connector_id = _create_connector(
        client,
        connector_type="object_storage",
        vendor="minio",
        connection_method="provision_in_cluster",
    )

    response = client.post(f"/api/v1/connectors/{connector_id}/provision")
    assert response.status_code == 200
    body = response.json()
    assert body["connector_id"] == connector_id
    assert body["status"] == "provisioned"
    assert body["endpoint"] == "http://sip-minio.sip-dev.svc.cluster.local:9000"
    assert body["started_at"] is not None
    assert body["completed_at"] is not None

    get_response = client.get(f"/api/v1/connectors/{connector_id}")
    provision = get_response.json()["connector_configuration"]["provision"]
    assert provision["status"] == "provisioned"
    assert provision["endpoint"] == body["endpoint"]

    with Session(db_engine) as session:
        transaction = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.resource_id == connector_id,
                SemanticTransaction.transaction_type == "connector.provisioned",
            )
        )
        assert transaction is not None
        step_count = session.scalar(
            select(func.count())
            .select_from(TraceStep)
            .where(TraceStep.semantic_transaction_id == transaction.id)
        )
        assert step_count == 4


def test_provision_fuseki_connector_happy_path(client: TestClient) -> None:
    connector_id = _create_connector(
        client,
        connector_type="ontology_knowledge_graph",
        vendor="apache_fuseki",
        connection_method="provision_in_cluster",
    )

    response = client.post(f"/api/v1/connectors/{connector_id}/provision")
    assert response.status_code == 200
    assert response.json()["endpoint"] == "http://sip-fuseki.sip-dev.svc.cluster.local:3030"


def test_provision_is_idempotent(client: TestClient, db_engine: Engine) -> None:
    connector_id = _create_connector(
        client,
        connector_type="object_storage",
        vendor="minio",
        connection_method="provision_in_cluster",
    )

    first = client.post(f"/api/v1/connectors/{connector_id}/provision")
    second = client.post(f"/api/v1/connectors/{connector_id}/provision")
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()

    with Session(db_engine) as session:
        transaction_count = session.scalar(
            select(func.count())
            .select_from(SemanticTransaction)
            .where(
                SemanticTransaction.resource_id == connector_id,
                SemanticTransaction.transaction_type == "connector.provisioned",
            )
        )
        assert transaction_count == 1


def test_provision_rejects_existing_instance(client: TestClient) -> None:
    connector_id = _create_connector(
        client,
        connector_type="object_storage",
        vendor="minio",
        connection_method="existing_instance",
    )

    response = client.post(f"/api/v1/connectors/{connector_id}/provision")
    assert response.status_code == 422
    assert "existing_instance" in response.json()["detail"]


def test_provision_rejects_deprecated_connector(client: TestClient) -> None:
    connector_id = _create_connector(
        client,
        connector_type="object_storage",
        vendor="minio",
        connection_method="provision_in_cluster",
    )
    client.patch(
        f"/api/v1/connectors/{connector_id}/status",
        json={"status": "Configured"},
    )
    client.patch(
        f"/api/v1/connectors/{connector_id}/status",
        json={"status": "Active"},
    )
    client.patch(
        f"/api/v1/connectors/{connector_id}/status",
        json={"status": "Deprecated"},
    )

    response = client.post(f"/api/v1/connectors/{connector_id}/provision")
    assert response.status_code == 422
    assert "Deprecated" in response.json()["detail"]


def test_provision_rejects_retired_connector(client: TestClient) -> None:
    connector_id = _create_connector(
        client,
        connector_type="object_storage",
        vendor="minio",
        connection_method="provision_in_cluster",
    )
    for next_status in ("Configured", "Active", "Deprecated", "Retired"):
        client.patch(
            f"/api/v1/connectors/{connector_id}/status",
            json={"status": next_status},
        )

    response = client.post(f"/api/v1/connectors/{connector_id}/provision")
    assert response.status_code == 422
    assert "Retired" in response.json()["detail"]


def test_provision_returns_404_for_missing_connector(client: TestClient) -> None:
    missing_id = uuid4()
    response = client.post(f"/api/v1/connectors/{missing_id}/provision")
    assert response.status_code == 404


def test_provision_rejects_unsupported_vendor(client: TestClient) -> None:
    connector_id = _create_connector(
        client,
        connector_type="database",
        vendor="postgresql",
        connection_method="provision_in_cluster",
    )

    response = client.post(f"/api/v1/connectors/{connector_id}/provision")
    assert response.status_code == 422
    assert "postgresql" in response.json()["detail"]
