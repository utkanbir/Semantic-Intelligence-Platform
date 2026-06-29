"""Repository round-trip tests for asset registry persistence."""

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
import app.modules.assets.repositories.orm_models  # noqa: F401
from app.modules.applications.domain.enums import ApplicationStatus
from app.modules.applications.domain.models import Application, ApplicationWorkspace
from app.modules.applications.repositories.orm_models import Base as ApplicationsBase
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.assets.domain.enums import AssetRecordStatus, AssetType
from app.modules.assets.domain.models import AssetRecord
from app.modules.assets.repositories.interfaces import DuplicateAssetRecordError
from app.modules.assets.repositories.sqlalchemy_repository import SqlAlchemyAssetRecordRepository


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
        key="asset-test-app",
        name="Asset Test App",
        status=ApplicationStatus.PROVISIONED,
        workspace=ApplicationWorkspace(
            id=uuid4(),
            application_id=uuid4(),
            postgres_schema="sip_asset_test_app",
            minio_namespace="sip-asset-test-app",
            fuseki_dataset="sip/asset-test-app",
            qdrant_collection="sip_asset_test_app",
            metadata_domain="sip-asset-test-app",
            ontology_namespace="sip.asset-test-app.ontology",
            agent_namespace="sip-asset-test-app.agents",
            product_registry_namespace="sip-asset-test-app.products",
            agent_registry_namespace="sip-asset-test-app.agent-runtime",
        ),
    )
    application.workspace.application_id = application.id
    persisted = SqlAlchemyApplicationRepository(db_session).create(application)
    return persisted.id


def _sample_asset(application_id: UUID, *, resource_id: str | None = None) -> AssetRecord:
    now = datetime(2026, 6, 28, 15, 0, 0, tzinfo=UTC)
    return AssetRecord(
        id=uuid4(),
        application_id=application_id,
        asset_type=AssetType.BLUEPRINT,
        resource_type="Blueprint",
        resource_id=resource_id or str(uuid4()),
        status=AssetRecordStatus.DRAFT,
        title="Registered Blueprint",
        created_by="architect-1",
        created_at=now,
        updated_at=now,
        metadata={"source": "manual"},
    )


def test_create_and_get_asset_record(db_session: Session, application_id: UUID) -> None:
    repo = SqlAlchemyAssetRecordRepository(db_session)
    asset_id = uuid4()
    record = _sample_asset(application_id)
    record = AssetRecord(
        id=asset_id,
        application_id=record.application_id,
        asset_type=record.asset_type,
        resource_type=record.resource_type,
        resource_id=record.resource_id,
        status=record.status,
        title=record.title,
        created_by=record.created_by,
        created_at=record.created_at,
        updated_at=record.updated_at,
        metadata=record.metadata,
    )

    created = repo.create(record)
    assert created.id == asset_id
    assert created.status == AssetRecordStatus.DRAFT

    loaded = repo.get(asset_id)
    assert loaded is not None
    assert loaded.metadata == {"source": "manual"}


def test_list_assets_by_application(db_session: Session, application_id: UUID) -> None:
    repo = SqlAlchemyAssetRecordRepository(db_session)
    repo.create(_sample_asset(application_id))
    repo.create(_sample_asset(application_id, resource_id=str(uuid4())))

    listed = repo.list_by_application(application_id)
    assert len(listed) == 2

    filtered = repo.list_by_application(application_id, asset_type=AssetType.BLUEPRINT.value)
    assert len(filtered) == 2


def test_duplicate_asset_record_raises(db_session: Session, application_id: UUID) -> None:
    repo = SqlAlchemyAssetRecordRepository(db_session)
    record = _sample_asset(application_id, resource_id="same-resource")
    repo.create(record)

    duplicate = _sample_asset(application_id, resource_id="same-resource")
    with pytest.raises(DuplicateAssetRecordError):
        repo.create(duplicate)


def test_update_asset_record(db_session: Session, application_id: UUID) -> None:
    repo = SqlAlchemyAssetRecordRepository(db_session)
    created = repo.create(_sample_asset(application_id))
    updated_at = datetime(2026, 6, 28, 16, 0, 0, tzinfo=UTC)

    updated = repo.update(
        AssetRecord(
            id=created.id,
            application_id=created.application_id,
            asset_type=created.asset_type,
            resource_type=created.resource_type,
            resource_id=created.resource_id,
            status=AssetRecordStatus.ACTIVE,
            title="Updated title",
            description="Updated description",
            created_by=created.created_by,
            created_at=created.created_at,
            updated_at=updated_at,
            metadata={"source": "manual", "reviewed": True},
        )
    )

    assert updated is not None
    assert updated.status == AssetRecordStatus.ACTIVE
    assert updated.title == "Updated title"
    assert updated.metadata == {"source": "manual", "reviewed": True}
