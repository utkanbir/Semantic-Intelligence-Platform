"""Repository round-trip tests for blueprint persistence."""

from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.applications.repositories.orm_models  # noqa: F401
import app.modules.blueprints.repositories.orm_models  # noqa: F401
from app.modules.applications.domain.enums import ApplicationStatus
from app.modules.applications.domain.models import Application, ApplicationWorkspace
from app.modules.applications.repositories.orm_models import Base as ApplicationsBase
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.blueprints.domain.enums import BlueprintStatus
from app.modules.blueprints.domain.models import Blueprint
from app.modules.blueprints.repositories.sqlalchemy_repository import (
    SqlAlchemyBlueprintRepository,
)


@pytest.fixture()
def db_engine() -> Generator[Engine, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    ApplicationsBase.metadata.create_all(bind=engine)
    yield engine
    ApplicationsBase.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session(db_engine: Engine) -> Generator[Session, None, None]:
    session = sessionmaker(
        bind=db_engine,
        autoflush=False,
        autocommit=False,
        class_=Session,
    )()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def application_id(db_session: Session) -> UUID:
    application = Application(
        id=uuid4(),
        key="blueprint-test-app",
        name="Blueprint Test App",
        status=ApplicationStatus.PROVISIONED,
        workspace=ApplicationWorkspace(
            id=uuid4(),
            application_id=uuid4(),
            postgres_schema="sip_blueprint_test_app",
            minio_namespace="sip-blueprint-test-app",
            fuseki_dataset="sip/blueprint-test-app",
            qdrant_collection="sip_blueprint_test_app",
            metadata_domain="sip-blueprint-test-app",
            ontology_namespace="sip.blueprint-test-app.ontology",
            agent_namespace="sip-blueprint-test-app.agents",
            product_registry_namespace="sip-blueprint-test-app.products",
            agent_registry_namespace="sip-blueprint-test-app.agent-runtime",
        ),
    )
    application.workspace.application_id = application.id
    persisted = SqlAlchemyApplicationRepository(db_session).create(application)
    return persisted.id


def test_create_and_get_blueprint(db_session: Session, application_id: UUID) -> None:
    repo = SqlAlchemyBlueprintRepository(db_session)
    blueprint_id = uuid4()
    created_at = datetime(2026, 6, 28, 14, 0, 0, tzinfo=UTC)
    snapshot = {"goal": "Assess vendors", "personas": []}

    created = repo.create(
        Blueprint(
            id=blueprint_id,
            application_id=application_id,
            version_number=1,
            status=BlueprintStatus.DRAFT,
            title="Vendor Assessment Blueprint",
            created_by="architect-1",
            created_at=created_at,
            blueprint_snapshot=snapshot,
        )
    )

    assert created.id == blueprint_id
    assert created.status == BlueprintStatus.DRAFT
    assert created.blueprint_snapshot == snapshot

    loaded = repo.get(blueprint_id)
    assert loaded is not None
    assert loaded.title == "Vendor Assessment Blueprint"


def test_list_blueprints_by_application(db_session: Session, application_id: UUID) -> None:
    repo = SqlAlchemyBlueprintRepository(db_session)
    now = datetime(2026, 6, 28, 14, 0, 0, tzinfo=UTC)

    repo.create(
        Blueprint(
            id=uuid4(),
            application_id=application_id,
            version_number=1,
            status=BlueprintStatus.DRAFT,
            title="v1",
            created_by="user",
            created_at=now,
            blueprint_snapshot={},
        )
    )
    repo.create(
        Blueprint(
            id=uuid4(),
            application_id=application_id,
            version_number=2,
            status=BlueprintStatus.DRAFT,
            title="v2",
            created_by="user",
            created_at=now,
            blueprint_snapshot={},
            previous_version_id=uuid4(),
        )
    )

    listed = repo.list_by_application(application_id)
    assert len(listed) == 2
    assert listed[0].version_number == 2


def test_update_blueprint(db_session: Session, application_id: UUID) -> None:
    repo = SqlAlchemyBlueprintRepository(db_session)
    blueprint_id = uuid4()
    now = datetime(2026, 6, 28, 14, 0, 0, tzinfo=UTC)

    repo.create(
        Blueprint(
            id=blueprint_id,
            application_id=application_id,
            version_number=1,
            status=BlueprintStatus.DRAFT,
            title="Before",
            created_by="user",
            created_at=now,
            blueprint_snapshot={"goal": "old"},
        )
    )

    current = repo.get(blueprint_id)
    assert current is not None
    updated = repo.update(
        Blueprint(
            id=current.id,
            application_id=current.application_id,
            version_number=current.version_number,
            previous_version_id=current.previous_version_id,
            status=BlueprintStatus.REVIEW,
            title="After",
            goal="New goal",
            outcome=current.outcome,
            created_by=current.created_by,
            created_at=current.created_at,
            approved_at=current.approved_at,
            version_created_at=current.version_created_at,
            blueprint_snapshot={"goal": "new"},
        )
    )

    assert updated is not None
    assert updated.status == BlueprintStatus.REVIEW
    assert updated.title == "After"
    assert updated.blueprint_snapshot == {"goal": "new"}
