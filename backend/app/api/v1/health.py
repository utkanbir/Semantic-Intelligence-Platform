"""Platform health, readiness, and liveness endpoints (ADR-001)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.services.health_service import check_database_readiness
from app.core.config import get_settings
from app.infrastructure.database import get_db

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


class HealthResponse(BaseModel):
    """Health probe response payload."""

    status: str
    service: str
    environment: str
    database: str | None = None


def _health_payload(status_text: str = "ok", database: str | None = None) -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status=status_text,
        service=settings.app_name,
        environment=settings.environment,
        database=database,
    )


@router.get("", response_model=HealthResponse, response_model_exclude_none=True)
async def health_check() -> HealthResponse:
    """General health check for operators and ingress."""
    return _health_payload()


@router.get("/ready", response_model=HealthResponse, response_model_exclude_none=True)
async def readiness_probe(db: DbSession) -> HealthResponse:
    """Kubernetes readiness probe with database dependency validation."""
    db_ok, db_status = check_database_readiness(db)
    if not db_ok:
        payload = _health_payload(status_text="degraded", database=db_status)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=payload.model_dump(exclude_none=True),
        )
    return _health_payload(database=db_status)


@router.get("/live", response_model=HealthResponse, response_model_exclude_none=True)
async def liveness_probe() -> HealthResponse:
    """Kubernetes liveness probe."""
    return _health_payload()
