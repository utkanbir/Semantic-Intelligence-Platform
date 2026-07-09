"""API tests for ontology chat endpoint (S38-05)."""

from __future__ import annotations

from collections.abc import Generator
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.applications.repositories.orm_models  # noqa: F401
import app.modules.audit_trace.repositories.orm_models  # noqa: F401
import app.modules.ontology.repositories.orm_models  # noqa: F401
from app.core.config import get_settings
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


@pytest.fixture(autouse=True)
def _llm_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("SIP_LLM_ENABLED", "true")
    monkeypatch.setenv("SIP_LLM_PROVIDER", "stub")
    yield
    get_settings.cache_clear()


def _create_application(client: TestClient) -> str:
    response = client.post(
        "/api/v1/applications",
        json={"key": f"chat-api-{uuid4()}", "name": "Chat API App"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_ontology(client: TestClient, application_id: str) -> str:
    response = client.post(
        "/api/v1/ontologies",
        json={
            "application_id": application_id,
            "title": "Invoice Ontology",
            "ontology_definition": {
                "classes": [
                    {
                        "name": "Invoice",
                        "label": "Invoice",
                        "description": "A billing document",
                    }
                ],
                "properties": [
                    {
                        "name": "invoiceAmount",
                        "label": "Invoice Amount",
                        "domain": "Invoice",
                        "datatype": "decimal",
                    }
                ],
                "relationships": [
                    {
                        "name": "issuedBy",
                        "domain": "Invoice",
                        "range": "Vendor",
                    }
                ],
            },
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_ontology_chat_happy_path(client: TestClient, db_engine: Engine) -> None:
    application_id = _create_application(client)
    ontology_id = _create_ontology(client, application_id)

    response = client.post(
        "/api/v1/chat/ontology",
        json={
            "ontology_id": ontology_id,
            "question": "What is Invoice?",
            "initiated_by": "test-user",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Completed"
    assert body["trace_step_count"] == 6
    assert body["answer"]
    assert body["semantic_transaction_id"]

    with Session(bind=db_engine) as session:
        transaction = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.id == UUID(body["semantic_transaction_id"])
            )
        )
        assert transaction is not None
        assert transaction.transaction_type == "ontology.question_answered"
        assert transaction.status == "Completed"
        assert transaction.initiated_by == "test-user"
        assert transaction.participating_assets["ontology_id"] == ontology_id

        steps = session.scalars(
            select(TraceStep)
            .where(TraceStep.semantic_transaction_id == transaction.id)
            .order_by(TraceStep.step_number.asc())
        ).all()
        assert len(steps) == 6
        assert [step.step_type for step in steps] == [
            "QuestionReceived",
            "IntentAnalysis",
            "OntologyContextRetrieved",
            "LLMResponseGenerated",
            "AnswerReturned",
            "SemanticTransactionCompleted",
        ]
        assert steps[0].layer == "ExperienceLayer"
        assert steps[2].layer == "KnowledgeLayer"


def test_ontology_chat_returns_404_for_missing_ontology(client: TestClient) -> None:
    response = client.post(
        "/api/v1/chat/ontology",
        json={"ontology_id": str(uuid4()), "question": "What is Invoice?"},
    )
    assert response.status_code == 404


def test_ontology_chat_returns_503_when_llm_disabled(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    application_id = _create_application(client)
    ontology_id = _create_ontology(client, application_id)
    monkeypatch.setenv("SIP_LLM_ENABLED", "false")
    get_settings.cache_clear()

    response = client.post(
        "/api/v1/chat/ontology",
        json={"ontology_id": ontology_id, "question": "What is Invoice?"},
    )
    assert response.status_code == 503
