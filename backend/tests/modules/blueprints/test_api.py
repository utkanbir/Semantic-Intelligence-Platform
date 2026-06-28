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
