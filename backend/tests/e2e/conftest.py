"""Shared E2E fixtures: in-memory sqlite DB and TestClient with all ORM models."""

from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.adapters.repositories.orm_models  # noqa: F401
import app.modules.agent_runtime.repositories.orm_models  # noqa: F401
import app.modules.agents.repositories.orm_models  # noqa: F401
import app.modules.applications.repositories.orm_models  # noqa: F401
import app.modules.assets.repositories.orm_models  # noqa: F401
import app.modules.audit_trace.repositories.orm_models  # noqa: F401
import app.modules.blueprints.repositories.orm_models  # noqa: F401
import app.modules.discovery.repositories.orm_models  # noqa: F401
import app.modules.governance.repositories.orm_models  # noqa: F401
import app.modules.knowledge_graph.repositories.orm_models  # noqa: F401
import app.modules.ontology.repositories.orm_models  # noqa: F401
import app.modules.products.repositories.orm_models  # noqa: F401
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
