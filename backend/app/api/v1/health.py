"""Platform health, readiness, and liveness endpoints (ADR-001)."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter()


class HealthResponse(BaseModel):
    """Health probe response payload."""

    status: str
    service: str
    environment: str


def _health_payload() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        environment=settings.environment,
    )


@router.get("", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """General health check for operators and ingress."""
    return _health_payload()


@router.get("/ready", response_model=HealthResponse)
async def readiness_probe() -> HealthResponse:
    """Kubernetes readiness probe — extend with dependency checks in later sprints."""
    return _health_payload()


@router.get("/live", response_model=HealthResponse)
async def liveness_probe() -> HealthResponse:
    """Kubernetes liveness probe."""
    return _health_payload()
