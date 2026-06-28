"""API tests for discovery session CRUD."""

from __future__ import annotations

from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.applications.repositories.orm_models  # noqa: F401
import app.modules.discovery.repositories.orm_models  # noqa: F401
from app.infrastructure.database import get_db
from app.main import app as fastapi_app
from app.modules.applications.repositories.orm_models import Base


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
        json={"key": "discovery-api-app", "name": "Discovery API App"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_discovery_session(client: TestClient) -> None:
    application_id = _create_application(client)

    response = client.post(
        "/api/v1/discovery-sessions",
        json={
            "application_id": application_id,
            "title": "Q3 Intent Workshop",
            "started_by": "analyst-1",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["application_id"] == application_id
    assert body["title"] == "Q3 Intent Workshop"
    assert body["started_by"] == "analyst-1"
    assert body["status"] == "Active"
    assert body["current_phase"] == {"phase_number": 1, "phase_name": "Intent Discovery"}
    assert body["recommendations"] == []
    assert body["conversation_history"] == []


def test_create_discovery_session_without_started_by(client: TestClient) -> None:
    application_id = _create_application(client)

    response = client.post(
        "/api/v1/discovery-sessions",
        json={"application_id": application_id, "title": "Anonymous session"},
    )

    assert response.status_code == 201
    assert response.json()["started_by"] == ""


def test_create_discovery_session_returns_404_for_unknown_application(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/discovery-sessions",
        json={"application_id": str(uuid4()), "title": "Orphan session"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Application not found"


def test_list_discovery_sessions_by_application(client: TestClient) -> None:
    application_id = _create_application(client)

    first = client.post(
        "/api/v1/discovery-sessions",
        json={"application_id": application_id, "title": "Session A"},
    )
    second = client.post(
        "/api/v1/discovery-sessions",
        json={"application_id": application_id, "title": "Session B"},
    )
    assert first.status_code == 201
    assert second.status_code == 201

    listed = client.get(
        "/api/v1/discovery-sessions",
        params={"application_id": application_id},
    )

    assert listed.status_code == 200
    titles = {item["title"] for item in listed.json()}
    assert titles == {"Session A", "Session B"}


def test_get_discovery_session(client: TestClient) -> None:
    application_id = _create_application(client)
    created = client.post(
        "/api/v1/discovery-sessions",
        json={"application_id": application_id, "title": "Detail session"},
    )
    assert created.status_code == 201
    session_id = created.json()["id"]

    got = client.get(f"/api/v1/discovery-sessions/{session_id}")

    assert got.status_code == 200
    assert got.json()["id"] == session_id
    assert got.json()["title"] == "Detail session"
    assert got.json()["current_phase"]["phase_number"] == 1


def test_update_discovery_session(client: TestClient) -> None:
    application_id = _create_application(client)
    created = client.post(
        "/api/v1/discovery-sessions",
        json={"application_id": application_id, "title": "Before update"},
    )
    assert created.status_code == 201
    session_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/discovery-sessions/{session_id}",
        json={
            "title": "After update",
            "intent_summary": "Capture goals",
            "discovery_notes": "Kickoff notes",
            "recommendations": [{"topic": "users"}],
            "conversation_history": [
                {"role": "user", "content": "Hello", "timestamp": "2026-06-28T12:00:00Z"}
            ],
        },
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "After update"
    assert body["intent_summary"] == "Capture goals"
    assert body["discovery_notes"] == "Kickoff notes"
    assert body["recommendations"] == [{"topic": "users"}]
    assert body["conversation_history"] == [
        {"role": "user", "content": "Hello", "timestamp": "2026-06-28T12:00:00Z"}
    ]
    assert body["current_phase"]["phase_name"] == "Intent Discovery"


def test_get_discovery_session_returns_404_when_missing(client: TestClient) -> None:
    response = client.get(f"/api/v1/discovery-sessions/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Discovery session not found"


def _create_session(client: TestClient, application_id: str, title: str = "Status test") -> str:
    response = client.post(
        "/api/v1/discovery-sessions",
        json={"application_id": application_id, "title": title},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_patch_status_active_to_paused_and_back(client: TestClient) -> None:
    application_id = _create_application(client)
    session_id = _create_session(client, application_id)

    paused = client.patch(
        f"/api/v1/discovery-sessions/{session_id}/status",
        json={"status": "Paused"},
    )
    assert paused.status_code == 200
    assert paused.json()["status"] == "Paused"

    active = client.patch(
        f"/api/v1/discovery-sessions/{session_id}/status",
        json={"status": "Active"},
    )
    assert active.status_code == 200
    assert active.json()["status"] == "Active"


def test_patch_status_to_completed_sets_completed_at(client: TestClient) -> None:
    application_id = _create_application(client)
    session_id = _create_session(client, application_id)

    completed = client.patch(
        f"/api/v1/discovery-sessions/{session_id}/status",
        json={"status": "Completed"},
    )
    assert completed.status_code == 200
    body = completed.json()
    assert body["status"] == "Completed"
    assert body["completed_at"] is not None


def test_patch_status_invalid_from_completed(client: TestClient) -> None:
    application_id = _create_application(client)
    session_id = _create_session(client, application_id)
    client.patch(
        f"/api/v1/discovery-sessions/{session_id}/status",
        json={"status": "Completed"},
    )

    response = client.patch(
        f"/api/v1/discovery-sessions/{session_id}/status",
        json={"status": "Active"},
    )
    assert response.status_code == 422


def test_patch_status_completed_to_archived(client: TestClient) -> None:
    application_id = _create_application(client)
    session_id = _create_session(client, application_id)
    client.patch(
        f"/api/v1/discovery-sessions/{session_id}/status",
        json={"status": "Completed"},
    )

    archived = client.patch(
        f"/api/v1/discovery-sessions/{session_id}/status",
        json={"status": "Archived"},
    )
    assert archived.status_code == 200
    assert archived.json()["status"] == "Archived"


def test_patch_status_archived_is_terminal(client: TestClient) -> None:
    application_id = _create_application(client)
    session_id = _create_session(client, application_id)

    archived = client.patch(
        f"/api/v1/discovery-sessions/{session_id}/status",
        json={"status": "Archived"},
    )
    assert archived.status_code == 200

    blocked = client.patch(
        f"/api/v1/discovery-sessions/{session_id}/status",
        json={"status": "Active"},
    )
    assert blocked.status_code == 422


def test_advance_phase_moves_to_next_phase(client: TestClient) -> None:
    application_id = _create_application(client)
    session_id = _create_session(client, application_id)

    advanced = client.post(
        f"/api/v1/discovery-sessions/{session_id}/phases/advance",
        json={"notes": "Users identified"},
    )
    assert advanced.status_code == 200
    body = advanced.json()
    assert body["current_phase"] == {"phase_number": 2, "phase_name": "User Discovery"}

    history = client.get(f"/api/v1/discovery-sessions/{session_id}/phases")
    assert history.status_code == 200
    phases = history.json()
    assert len(phases) == 2
    assert phases[1]["phase_number"] == 2
    assert phases[1]["notes"] == "Users identified"


def test_advance_phase_rejected_when_paused(client: TestClient) -> None:
    application_id = _create_application(client)
    session_id = _create_session(client, application_id)
    client.patch(
        f"/api/v1/discovery-sessions/{session_id}/status",
        json={"status": "Paused"},
    )

    response = client.post(f"/api/v1/discovery-sessions/{session_id}/phases/advance", json={})
    assert response.status_code == 422
