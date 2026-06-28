"""API tests for blueprint CRUD."""

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
import app.modules.blueprints.repositories.orm_models  # noqa: F401
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
        json={"key": "blueprint-api-app", "name": "Blueprint API App"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_blueprint(client: TestClient) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/blueprints",
        json={
            "application_id": application_id,
            "title": "Assessment Blueprint",
            "created_by": "architect-1",
            "goal": "Vendor assessment",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["application_id"] == application_id
    assert body["title"] == "Assessment Blueprint"
    assert body["status"] == "Draft"
    assert body["version_number"] == 1
    assert body["blueprint_snapshot"]["personas"] == []


def test_create_blueprint_returns_404_for_unknown_application(client: TestClient) -> None:
    response = client.post(
        "/api/v1/blueprints",
        json={"application_id": str(uuid4()), "title": "Orphan"},
    )
    assert response.status_code == 404


def test_list_and_get_blueprint(client: TestClient) -> None:
    application_id = _create_application(client)
    created = client.post(
        "/api/v1/blueprints",
        json={"application_id": application_id, "title": "Listed Blueprint"},
    )
    assert created.status_code == 201
    blueprint_id = created.json()["id"]

    listed = client.get("/api/v1/blueprints", params={"application_id": application_id})
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    got = client.get(f"/api/v1/blueprints/{blueprint_id}")
    assert got.status_code == 200
    assert got.json()["title"] == "Listed Blueprint"


def test_update_blueprint(client: TestClient) -> None:
    application_id = _create_application(client)
    created = client.post(
        "/api/v1/blueprints",
        json={"application_id": application_id, "title": "Before"},
    )
    blueprint_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/blueprints/{blueprint_id}",
        json={
            "title": "After",
            "goal": "Updated goal",
            "blueprint_snapshot": {"goal": "new", "personas": ["analyst"]},
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "After"
    assert body["goal"] == "Updated goal"
    assert body["blueprint_snapshot"]["personas"] == ["analyst"]


def _create_blueprint(client: TestClient, application_id: str) -> str:
    response = client.post(
        "/api/v1/blueprints",
        json={"application_id": application_id, "title": "Lifecycle test"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_patch_status_draft_to_review_to_approved(client: TestClient) -> None:
    application_id = _create_application(client)
    blueprint_id = _create_blueprint(client, application_id)

    review = client.patch(
        f"/api/v1/blueprints/{blueprint_id}/status",
        json={"status": "Review"},
    )
    assert review.status_code == 200
    assert review.json()["status"] == "Review"

    approved = client.patch(
        f"/api/v1/blueprints/{blueprint_id}/status",
        json={"status": "Approved"},
    )
    assert approved.status_code == 200
    body = approved.json()
    assert body["status"] == "Approved"
    assert body["approved_at"] is not None


def test_patch_status_review_back_to_draft(client: TestClient) -> None:
    application_id = _create_application(client)
    blueprint_id = _create_blueprint(client, application_id)
    client.patch(f"/api/v1/blueprints/{blueprint_id}/status", json={"status": "Review"})

    draft = client.patch(
        f"/api/v1/blueprints/{blueprint_id}/status",
        json={"status": "Draft"},
    )
    assert draft.status_code == 200
    assert draft.json()["status"] == "Draft"


def test_patch_status_invalid_transition_returns_422(client: TestClient) -> None:
    application_id = _create_application(client)
    blueprint_id = _create_blueprint(client, application_id)

    response = client.patch(
        f"/api/v1/blueprints/{blueprint_id}/status",
        json={"status": "Approved"},
    )
    assert response.status_code == 422


def test_patch_status_versioned_to_retired(client: TestClient) -> None:
    application_id = _create_application(client)
    blueprint_id = _create_blueprint(client, application_id)
    for status in ("Review", "Approved", "Versioned"):
        client.patch(
            f"/api/v1/blueprints/{blueprint_id}/status",
            json={"status": status},
        )

    retired = client.patch(
        f"/api/v1/blueprints/{blueprint_id}/status",
        json={"status": "Retired"},
    )
    assert retired.status_code == 200
    assert retired.json()["status"] == "Retired"

    blocked = client.patch(
        f"/api/v1/blueprints/{blueprint_id}/status",
        json={"status": "Draft"},
    )
    assert blocked.status_code == 422


def _advance_to_approved(client: TestClient, blueprint_id: str) -> None:
    for status in ("Review", "Approved"):
        response = client.patch(
            f"/api/v1/blueprints/{blueprint_id}/status",
            json={"status": status},
        )
        assert response.status_code == 200


def test_create_version_from_approved_copies_snapshot(client: TestClient) -> None:
    application_id = _create_application(client)
    blueprint_id = _create_blueprint(client, application_id)
    client.patch(
        f"/api/v1/blueprints/{blueprint_id}",
        json={"blueprint_snapshot": {"goal": "v1", "personas": ["analyst"]}},
    )
    _advance_to_approved(client, blueprint_id)

    parent_before = client.get(f"/api/v1/blueprints/{blueprint_id}").json()

    version = client.post(f"/api/v1/blueprints/{blueprint_id}/versions", json={})
    assert version.status_code == 201
    body = version.json()
    assert body["id"] != blueprint_id
    assert body["status"] == "Draft"
    assert body["version_number"] == 2
    assert body["previous_version_id"] == blueprint_id
    assert body["version_created_at"] is not None
    assert body["blueprint_snapshot"] == {"goal": "v1", "personas": ["analyst"]}

    parent_after = client.get(f"/api/v1/blueprints/{blueprint_id}").json()
    assert parent_after == parent_before


def test_create_version_with_custom_snapshot(client: TestClient) -> None:
    application_id = _create_application(client)
    blueprint_id = _create_blueprint(client, application_id)
    _advance_to_approved(client, blueprint_id)

    version = client.post(
        f"/api/v1/blueprints/{blueprint_id}/versions",
        json={"blueprint_snapshot": {"goal": "v2", "personas": ["engineer"]}},
    )
    assert version.status_code == 201
    assert version.json()["blueprint_snapshot"] == {"goal": "v2", "personas": ["engineer"]}


def test_create_version_from_versioned_parent(client: TestClient) -> None:
    application_id = _create_application(client)
    blueprint_id = _create_blueprint(client, application_id)
    for status in ("Review", "Approved", "Versioned"):
        client.patch(
            f"/api/v1/blueprints/{blueprint_id}/status",
            json={"status": status},
        )

    version = client.post(f"/api/v1/blueprints/{blueprint_id}/versions", json={})
    assert version.status_code == 201
    assert version.json()["version_number"] == 2


def test_create_version_rejects_draft_parent(client: TestClient) -> None:
    application_id = _create_application(client)
    blueprint_id = _create_blueprint(client, application_id)

    response = client.post(f"/api/v1/blueprints/{blueprint_id}/versions", json={})
    assert response.status_code == 422
