"""API tests for published data product CRUD."""

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
import app.modules.products.repositories.orm_models  # noqa: F401
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


def _create_application(client: TestClient, *, key: str | None = None) -> str:
    response = client.post(
        "/api/v1/applications",
        json={
            "key": key or f"product-api-app-{uuid4()}",
            "name": "Product API App",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_asset(client: TestClient, application_id: str) -> str:
    response = client.post(
        "/api/v1/assets",
        json={
            "application_id": application_id,
            "asset_type": "Blueprint",
            "resource_type": "Blueprint",
            "resource_id": str(uuid4()),
            "title": "Source Asset",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_product(client: TestClient) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/products",
        json={
            "application_id": application_id,
            "title": "Assessment Dataset",
            "created_by": "data-engineer-1",
            "product_definition": {"schema_version": "1", "fields": [{"name": "id"}]},
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["application_id"] == application_id
    assert body["status"] == "Draft"
    assert body["version_number"] == 1
    assert body["product_definition"]["fields"][0]["name"] == "id"


def test_create_product_records_semantic_transaction(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/products",
        json={
            "application_id": application_id,
            "title": "Traced Product",
        },
    )
    assert response.status_code == 201
    product_id = response.json()["id"]

    with Session(db_engine) as session:
        row = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.resource_id == product_id,
            )
        )
        assert row is not None
        assert row.transaction_type == "product.created"
        assert row.resource_type == "PublishedDataProduct"


def test_create_product_with_source_assets(client: TestClient) -> None:
    application_id = _create_application(client)
    asset_id = _create_asset(client, application_id)
    response = client.post(
        "/api/v1/products",
        json={
            "application_id": application_id,
            "title": "Linked Product",
            "source_asset_record_ids": [asset_id],
        },
    )
    assert response.status_code == 201
    assert response.json()["source_asset_record_ids"] == [asset_id]


def test_create_product_returns_404_for_unknown_application(client: TestClient) -> None:
    response = client.post(
        "/api/v1/products",
        json={
            "application_id": str(uuid4()),
            "title": "Orphan Product",
        },
    )
    assert response.status_code == 404


def test_list_and_get_products(client: TestClient) -> None:
    application_id = _create_application(client)
    create_response = client.post(
        "/api/v1/products",
        json={"application_id": application_id, "title": "Listed Product"},
    )
    product_id = create_response.json()["id"]

    list_response = client.get("/api/v1/products", params={"application_id": application_id})
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = client.get(f"/api/v1/products/{product_id}")
    assert get_response.status_code == 200
    assert get_response.json()["title"] == "Listed Product"


def test_update_product(client: TestClient) -> None:
    application_id = _create_application(client)
    create_response = client.post(
        "/api/v1/products",
        json={"application_id": application_id, "title": "Original Title"},
    )
    product_id = create_response.json()["id"]

    patch_response = client.patch(
        f"/api/v1/products/{product_id}",
        json={"title": "Updated Title", "description": "Updated description"},
    )
    assert patch_response.status_code == 200
    body = patch_response.json()
    assert body["title"] == "Updated Title"
    assert body["description"] == "Updated description"


def test_update_product_returns_422_for_foreign_asset(client: TestClient) -> None:
    application_id = _create_application(client)
    other_application_id = _create_application(client)
    foreign_asset_id = _create_asset(client, other_application_id)

    create_response = client.post(
        "/api/v1/products",
        json={"application_id": application_id, "title": "Scoped Product"},
    )
    product_id = create_response.json()["id"]

    patch_response = client.patch(
        f"/api/v1/products/{product_id}",
        json={"source_asset_record_ids": [foreign_asset_id]},
    )
    assert patch_response.status_code == 422


def _create_product(client: TestClient, application_id: str) -> str:
    response = client.post(
        "/api/v1/products",
        json={"application_id": application_id, "title": "Lifecycle Product"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_patch_status_draft_to_certified_to_published(client: TestClient) -> None:
    application_id = _create_application(client)
    product_id = _create_product(client, application_id)

    certified = client.patch(
        f"/api/v1/products/{product_id}/status",
        json={"status": "Certified"},
    )
    assert certified.status_code == 200
    assert certified.json()["status"] == "Certified"
    assert certified.json()["certified_at"] is not None

    published = client.patch(
        f"/api/v1/products/{product_id}/status",
        json={"status": "Published"},
    )
    assert published.status_code == 200
    assert published.json()["status"] == "Published"
    assert published.json()["published_at"] is not None


def test_patch_status_certified_back_to_draft(client: TestClient) -> None:
    application_id = _create_application(client)
    product_id = _create_product(client, application_id)
    client.patch(f"/api/v1/products/{product_id}/status", json={"status": "Certified"})

    draft = client.patch(
        f"/api/v1/products/{product_id}/status",
        json={"status": "Draft"},
    )
    assert draft.status_code == 200
    assert draft.json()["status"] == "Draft"


def test_patch_status_invalid_transition_returns_422(client: TestClient) -> None:
    application_id = _create_application(client)
    product_id = _create_product(client, application_id)

    response = client.patch(
        f"/api/v1/products/{product_id}/status",
        json={"status": "Published"},
    )
    assert response.status_code == 422


def test_patch_status_full_lifecycle_to_retired(client: TestClient) -> None:
    application_id = _create_application(client)
    product_id = _create_product(client, application_id)
    for next_status in ("Certified", "Published", "Versioned", "Retired"):
        response = client.patch(
            f"/api/v1/products/{product_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200

    blocked = client.patch(
        f"/api/v1/products/{product_id}/status",
        json={"status": "Draft"},
    )
    assert blocked.status_code == 422


def _advance_to_published(client: TestClient, product_id: str) -> None:
    for next_status in ("Certified", "Published"):
        response = client.patch(
            f"/api/v1/products/{product_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200


def test_create_version_from_published_copies_definition(client: TestClient) -> None:
    application_id = _create_application(client)
    product_id = _create_product(client, application_id)
    client.patch(
        f"/api/v1/products/{product_id}",
        json={"product_definition": {"schema_version": "1", "fields": [{"name": "id"}]}},
    )
    _advance_to_published(client, product_id)

    parent_before = client.get(f"/api/v1/products/{product_id}").json()

    version = client.post(f"/api/v1/products/{product_id}/versions", json={})
    assert version.status_code == 201
    body = version.json()
    assert body["id"] != product_id
    assert body["status"] == "Draft"
    assert body["version_number"] == 2
    assert body["previous_version_id"] == product_id
    assert body["version_created_at"] is not None
    assert body["product_definition"] == {"schema_version": "1", "fields": [{"name": "id"}]}

    parent_after = client.get(f"/api/v1/products/{product_id}").json()
    assert parent_after == parent_before


def test_create_version_with_custom_definition(client: TestClient) -> None:
    application_id = _create_application(client)
    product_id = _create_product(client, application_id)
    _advance_to_published(client, product_id)

    version = client.post(
        f"/api/v1/products/{product_id}/versions",
        json={"product_definition": {"schema_version": "2", "fields": [{"name": "name"}]}},
    )
    assert version.status_code == 201
    assert version.json()["product_definition"] == {
        "schema_version": "2",
        "fields": [{"name": "name"}],
    }


def test_create_version_from_versioned_parent(client: TestClient) -> None:
    application_id = _create_application(client)
    product_id = _create_product(client, application_id)
    for next_status in ("Certified", "Published", "Versioned"):
        client.patch(
            f"/api/v1/products/{product_id}/status",
            json={"status": next_status},
        )

    version = client.post(f"/api/v1/products/{product_id}/versions", json={})
    assert version.status_code == 201
    assert version.json()["version_number"] == 2


def test_create_version_rejects_draft_parent(client: TestClient) -> None:
    application_id = _create_application(client)
    product_id = _create_product(client, application_id)

    response = client.post(f"/api/v1/products/{product_id}/versions", json={})
    assert response.status_code == 422
