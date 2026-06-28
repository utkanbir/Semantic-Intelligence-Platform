"""API tests for asset registry CRUD."""

from __future__ import annotations

from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.applications.repositories.orm_models  # noqa: F401
import app.modules.assets.repositories.orm_models  # noqa: F401
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


def _create_application(client: TestClient) -> str:
    response = client.post(
        "/api/v1/applications",
        json={"key": "asset-api-app", "name": "Asset API App"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_asset_record(client: TestClient) -> None:
    application_id = _create_application(client)
    resource_id = str(uuid4())
    response = client.post(
        "/api/v1/assets",
        json={
            "application_id": application_id,
            "asset_type": "Blueprint",
            "resource_type": "Blueprint",
            "resource_id": resource_id,
            "title": "Registered Blueprint",
            "created_by": "architect-1",
            "metadata": {"source": "manual"},
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["application_id"] == application_id
    assert body["resource_id"] == resource_id
    assert body["status"] == "Draft"
    assert body["metadata"] == {"source": "manual"}


def test_create_asset_record_records_semantic_transaction(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/assets",
        json={
            "application_id": application_id,
            "asset_type": "Blueprint",
            "resource_type": "Blueprint",
            "resource_id": str(uuid4()),
            "title": "Traced Asset",
        },
    )
    assert response.status_code == 201
    asset_record_id = response.json()["id"]

    with Session(db_engine) as session:
        row = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.resource_id == asset_record_id,
            )
        )
        assert row is not None
        assert row.transaction_type == "asset.created"
        assert row.resource_type == "AssetRecord"


def test_create_asset_record_returns_404_for_unknown_application(client: TestClient) -> None:
    response = client.post(
        "/api/v1/assets",
        json={
            "application_id": str(uuid4()),
            "asset_type": "Blueprint",
            "resource_type": "Blueprint",
            "resource_id": str(uuid4()),
            "title": "Orphan",
        },
    )
    assert response.status_code == 404


def test_create_duplicate_asset_record_returns_409(client: TestClient) -> None:
    application_id = _create_application(client)
    resource_id = str(uuid4())
    payload = {
        "application_id": application_id,
        "asset_type": "Blueprint",
        "resource_type": "Blueprint",
        "resource_id": resource_id,
        "title": "First",
    }
    first = client.post("/api/v1/assets", json=payload)
    assert first.status_code == 201

    second = client.post("/api/v1/assets", json={**payload, "title": "Duplicate"})
    assert second.status_code == 409


def test_list_and_get_asset_record(client: TestClient) -> None:
    application_id = _create_application(client)
    created = client.post(
        "/api/v1/assets",
        json={
            "application_id": application_id,
            "asset_type": "DiscoverySession",
            "resource_type": "DiscoverySession",
            "resource_id": str(uuid4()),
            "title": "Listed Asset",
        },
    )
    assert created.status_code == 201
    asset_record_id = created.json()["id"]

    listed = client.get("/api/v1/assets", params={"application_id": application_id})
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    filtered = client.get(
        "/api/v1/assets",
        params={"application_id": application_id, "asset_type": "DiscoverySession"},
    )
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1

    got = client.get(f"/api/v1/assets/{asset_record_id}")
    assert got.status_code == 200
    assert got.json()["title"] == "Listed Asset"


def test_update_asset_record(client: TestClient) -> None:
    application_id = _create_application(client)
    created = client.post(
        "/api/v1/assets",
        json={
            "application_id": application_id,
            "asset_type": "Blueprint",
            "resource_type": "Blueprint",
            "resource_id": str(uuid4()),
            "title": "Before",
        },
    )
    asset_record_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/assets/{asset_record_id}",
        json={
            "title": "After",
            "description": "Updated description",
            "metadata": {"reviewed": True},
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "After"
    assert body["description"] == "Updated description"
    assert body["metadata"] == {"reviewed": True}


def _create_asset(client: TestClient, application_id: str) -> str:
    response = client.post(
        "/api/v1/assets",
        json={
            "application_id": application_id,
            "asset_type": "Blueprint",
            "resource_type": "Blueprint",
            "resource_id": str(uuid4()),
            "title": "Lifecycle test",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_patch_status_draft_to_active_to_published(client: TestClient) -> None:
    application_id = _create_application(client)
    asset_record_id = _create_asset(client, application_id)

    active = client.patch(
        f"/api/v1/assets/{asset_record_id}/status",
        json={"status": "Active"},
    )
    assert active.status_code == 200
    assert active.json()["status"] == "Active"

    published = client.patch(
        f"/api/v1/assets/{asset_record_id}/status",
        json={"status": "Published"},
    )
    assert published.status_code == 200
    assert published.json()["status"] == "Published"


def test_patch_status_active_back_to_draft(client: TestClient) -> None:
    application_id = _create_application(client)
    asset_record_id = _create_asset(client, application_id)
    client.patch(f"/api/v1/assets/{asset_record_id}/status", json={"status": "Active"})

    draft = client.patch(
        f"/api/v1/assets/{asset_record_id}/status",
        json={"status": "Draft"},
    )
    assert draft.status_code == 200
    assert draft.json()["status"] == "Draft"


def test_patch_status_invalid_transition_returns_422(client: TestClient) -> None:
    application_id = _create_application(client)
    asset_record_id = _create_asset(client, application_id)

    response = client.patch(
        f"/api/v1/assets/{asset_record_id}/status",
        json={"status": "Published"},
    )
    assert response.status_code == 422


def test_patch_status_published_to_retired_via_deprecated(client: TestClient) -> None:
    application_id = _create_application(client)
    asset_record_id = _create_asset(client, application_id)
    for status in ("Active", "Published", "Deprecated", "Retired"):
        client.patch(
            f"/api/v1/assets/{asset_record_id}/status",
            json={"status": status},
        )

    blocked = client.patch(
        f"/api/v1/assets/{asset_record_id}/status",
        json={"status": "Active"},
    )
    assert blocked.status_code == 422
