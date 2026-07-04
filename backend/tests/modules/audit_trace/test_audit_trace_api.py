"""API tests for audit trace query endpoints."""

from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.applications.repositories.orm_models  # noqa: F401
import app.modules.audit_trace.repositories.orm_models  # noqa: F401
from app.infrastructure.database import get_db
from app.main import app as fastapi_app
from app.modules.applications.repositories.orm_models import Base
from app.modules.audit_trace.domain.models import TraceStep
from app.modules.audit_trace.repositories.orm_models import SemanticTransaction
from app.modules.audit_trace.repositories.sqlalchemy_repository import SqlAlchemyTraceStepRepository


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


def _seed_transaction_with_steps(
    db_engine: Engine,
    *,
    resource_id: str | None = None,
    application_id: UUID | None = None,
    transaction_type: str = "asset.created",
    resource_type: str = "AssetRecord",
    created_at: datetime | None = None,
) -> tuple[str, str]:
    resource_id = resource_id or str(uuid4())
    now = created_at or datetime(2026, 6, 28, 19, 0, 0, tzinfo=UTC)
    with Session(db_engine) as session:
        transaction = SemanticTransaction(
            id=uuid4(),
            transaction_type=transaction_type,
            resource_type=resource_type,
            resource_id=resource_id,
            application_id=application_id,
            created_at=now,
        )
        session.add(transaction)
        session.commit()
        session.refresh(transaction)
        trace_repo = SqlAlchemyTraceStepRepository(session)
        trace_repo.create(
            TraceStep(
                id=uuid4(),
                semantic_transaction_id=transaction.id,
                step_number=1,
                step_type="persist",
                message="Persisted row",
                created_at=now,
            )
        )
        return str(transaction.id), resource_id


def test_list_audit_traces_by_resource_id(client: TestClient, db_engine: Engine) -> None:
    transaction_id, resource_id = _seed_transaction_with_steps(db_engine)

    response = client.get("/api/v1/audit-traces", params={"resource_id": resource_id})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == transaction_id
    assert body[0]["transaction_type"] == "asset.created"
    assert len(body[0]["trace_steps"]) == 1


def test_list_audit_traces_without_filters_returns_latest_records(
    client: TestClient, db_engine: Engine
) -> None:
    older_id, _ = _seed_transaction_with_steps(
        db_engine,
        transaction_type="ontology.created",
        resource_type="OntologyDefinition",
        created_at=datetime(2026, 6, 28, 18, 59, 0, tzinfo=UTC),
    )
    newer_id, _ = _seed_transaction_with_steps(
        db_engine,
        transaction_type="ontology.published",
        resource_type="OntologyDefinition",
        created_at=datetime(2026, 6, 28, 19, 1, 0, tzinfo=UTC),
    )

    response = client.get("/api/v1/audit-traces")

    assert response.status_code == 200
    body = response.json()
    assert [row["id"] for row in body] == [newer_id, older_id]


def test_list_audit_traces_applies_default_limit(client: TestClient, db_engine: Engine) -> None:
    base_time = datetime(2026, 6, 28, 19, 0, 0, tzinfo=UTC)
    oldest_id: str | None = None
    newest_id: str | None = None
    for index in range(101):
        transaction_id, _ = _seed_transaction_with_steps(
            db_engine,
            transaction_type=f"ontology.event{index}",
            resource_type="OntologyDefinition",
            created_at=base_time + timedelta(seconds=index),
        )
        if index == 0:
            oldest_id = transaction_id
        if index == 100:
            newest_id = transaction_id

    response = client.get("/api/v1/audit-traces")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 100
    assert body[0]["id"] == newest_id
    assert all(row["id"] != oldest_id for row in body)


def test_list_audit_traces_for_frontend_ontology_first_load(
    client: TestClient, db_engine: Engine
) -> None:
    matching_id, _ = _seed_transaction_with_steps(
        db_engine,
        transaction_type="ontology.created",
        resource_type="OntologyDefinition",
        created_at=datetime(2026, 6, 28, 19, 0, 0, tzinfo=UTC),
    )
    newer_matching_id, _ = _seed_transaction_with_steps(
        db_engine,
        transaction_type="ontology.published",
        resource_type="OntologyDefinition",
        created_at=datetime(2026, 6, 28, 19, 1, 0, tzinfo=UTC),
    )
    _seed_transaction_with_steps(
        db_engine,
        transaction_type="asset.created",
        resource_type="AssetRecord",
        created_at=datetime(2026, 6, 28, 19, 2, 0, tzinfo=UTC),
    )
    _seed_transaction_with_steps(
        db_engine,
        transaction_type="agent.started",
        resource_type="OntologyDefinition",
        created_at=datetime(2026, 6, 28, 19, 3, 0, tzinfo=UTC),
    )

    response = client.get(
        "/api/v1/audit-traces",
        params={
            "resource_type": "OntologyDefinition",
            "transaction_type_prefix": "ontology",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert [row["id"] for row in body] == [newer_matching_id, matching_id]


def test_list_audit_traces_by_application_id_with_optional_filters(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = uuid4()
    matching_id, _ = _seed_transaction_with_steps(
        db_engine,
        application_id=application_id,
        transaction_type="ontology.created",
        resource_type="OntologyDefinition",
        created_at=datetime(2026, 6, 28, 19, 0, 0, tzinfo=UTC),
    )
    _seed_transaction_with_steps(
        db_engine,
        application_id=application_id,
        transaction_type="asset.created",
        resource_type="AssetRecord",
        created_at=datetime(2026, 6, 28, 19, 1, 0, tzinfo=UTC),
    )
    _seed_transaction_with_steps(
        db_engine,
        application_id=uuid4(),
        transaction_type="ontology.created",
        resource_type="OntologyDefinition",
        created_at=datetime(2026, 6, 28, 19, 2, 0, tzinfo=UTC),
    )

    response = client.get(
        "/api/v1/audit-traces",
        params={
            "application_id": str(application_id),
            "resource_type": "OntologyDefinition",
            "transaction_type_prefix": "ontology.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert [row["id"] for row in body] == [matching_id]


def test_list_audit_traces_rejects_resource_and_application_id_together(
    client: TestClient, db_engine: Engine
) -> None:
    _, resource_id = _seed_transaction_with_steps(db_engine, application_id=uuid4())

    response = client.get(
        "/api/v1/audit-traces",
        params={"resource_id": resource_id, "application_id": str(uuid4())},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Provide resource_id or application_id, not both"


def test_get_audit_trace_by_transaction_id(client: TestClient, db_engine: Engine) -> None:
    transaction_id, _ = _seed_transaction_with_steps(db_engine)

    response = client.get(f"/api/v1/audit-traces/{transaction_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["trace_steps"][0]["step_type"] == "persist"


def test_get_audit_trace_returns_404_for_unknown_id(client: TestClient) -> None:
    response = client.get(f"/api/v1/audit-traces/{uuid4()}")
    assert response.status_code == 404
