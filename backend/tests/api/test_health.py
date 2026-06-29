"""Health endpoint contract tests."""

from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.infrastructure.database import get_db
from app.main import app

client = TestClient(app)


def test_health_returns_200() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "sip-backend"
    assert body["environment"] == "development"


def test_readiness_probe_returns_200_when_db_is_reachable() -> None:
    class FakeDbSession:
        def execute(self, *_args: object, **_kwargs: object) -> int:
            return 1

    def override_get_db() -> Generator[FakeDbSession, None, None]:
        yield FakeDbSession()

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/api/v1/health/ready")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "reachable"


def test_readiness_probe_returns_503_when_db_is_unreachable() -> None:
    class FakeDbSession:
        def execute(self, *_args: object, **_kwargs: object) -> int:
            raise SQLAlchemyError("db down")

    def override_get_db() -> Generator[FakeDbSession, None, None]:
        yield FakeDbSession()

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/api/v1/health/ready")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    body = response.json()
    assert body["detail"]["status"] == "degraded"
    assert body["detail"]["database"] == "unreachable"


def test_liveness_probe_returns_200() -> None:
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
