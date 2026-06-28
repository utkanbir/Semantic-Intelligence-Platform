"""SQLAlchemy repository implementations for the applications module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.modules.applications.domain.models import Application, ApplicationWorkspace
from app.modules.applications.repositories.interfaces import (
    ApplicationRepository,
    DuplicateApplicationKeyError,
)
from app.modules.applications.repositories.orm_models import (
    Application as ApplicationORM,
)
from app.modules.applications.repositories.orm_models import (
    ApplicationWorkspace as ApplicationWorkspaceORM,
)


def _to_domain_workspace(workspace_orm: ApplicationWorkspaceORM) -> ApplicationWorkspace:
    return ApplicationWorkspace(
        id=workspace_orm.id,
        application_id=workspace_orm.application_id,
        status=workspace_orm.status,
        postgres_schema=workspace_orm.postgres_schema,
        minio_namespace=workspace_orm.minio_namespace,
        fuseki_dataset=workspace_orm.fuseki_dataset,
        qdrant_collection=workspace_orm.qdrant_collection,
        metadata_domain=workspace_orm.metadata_domain,
        ontology_namespace=workspace_orm.ontology_namespace,
        agent_namespace=workspace_orm.agent_namespace,
        product_registry_namespace=workspace_orm.product_registry_namespace,
        agent_registry_namespace=workspace_orm.agent_registry_namespace,
        created_at=workspace_orm.created_at,
        updated_at=workspace_orm.updated_at,
    )


def _to_domain_application(application_orm: ApplicationORM) -> Application:
    return Application(
        id=application_orm.id,
        key=application_orm.key,
        name=application_orm.name,
        description=application_orm.description,
        created_at=application_orm.created_at,
        updated_at=application_orm.updated_at,
        workspace=(
            _to_domain_workspace(application_orm.workspace) if application_orm.workspace else None
        ),
    )


class SqlAlchemyApplicationRepository(ApplicationRepository):
    """SQLAlchemy-backed implementation for applications persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, application: Application) -> Application:
        workspace = application.workspace
        if workspace is None:
            raise ValueError("Application workspace is required")

        application_orm = ApplicationORM(
            id=application.id,
            key=application.key,
            name=application.name,
            description=application.description,
            workspace=ApplicationWorkspaceORM(
                id=workspace.id,
                application_id=workspace.application_id,
                status=workspace.status,
                postgres_schema=workspace.postgres_schema,
                minio_namespace=workspace.minio_namespace,
                fuseki_dataset=workspace.fuseki_dataset,
                qdrant_collection=workspace.qdrant_collection,
                metadata_domain=workspace.metadata_domain,
                ontology_namespace=workspace.ontology_namespace,
                agent_namespace=workspace.agent_namespace,
                product_registry_namespace=workspace.product_registry_namespace,
                agent_registry_namespace=workspace.agent_registry_namespace,
            ),
        )
        self._session.add(application_orm)
        self._commit_or_raise_duplicate()
        self._session.refresh(application_orm)
        return _to_domain_application(application_orm)

    def list(self) -> Sequence[Application]:
        statement = (
            select(ApplicationORM)
            .options(selectinload(ApplicationORM.workspace))
            .order_by(ApplicationORM.created_at.desc())
        )
        return [_to_domain_application(item) for item in self._session.scalars(statement).all()]

    def get(self, application_id: UUID) -> Application | None:
        statement = (
            select(ApplicationORM)
            .options(selectinload(ApplicationORM.workspace))
            .where(ApplicationORM.id == application_id)
        )
        application_orm = self._session.scalars(statement).first()
        return _to_domain_application(application_orm) if application_orm else None

    def get_by_key(self, key: str) -> Application | None:
        statement = (
            select(ApplicationORM)
            .options(selectinload(ApplicationORM.workspace))
            .where(ApplicationORM.key == key)
        )
        application_orm = self._session.scalars(statement).first()
        return _to_domain_application(application_orm) if application_orm else None

    def get_by_postgres_schema(self, postgres_schema: str) -> Application | None:
        statement = (
            select(ApplicationORM)
            .join(ApplicationWorkspaceORM)
            .options(selectinload(ApplicationORM.workspace))
            .where(ApplicationWorkspaceORM.postgres_schema == postgres_schema)
        )
        application_orm = self._session.scalars(statement).first()
        return _to_domain_application(application_orm) if application_orm else None

    def update(self, application: Application) -> Application | None:
        statement = (
            select(ApplicationORM)
            .options(selectinload(ApplicationORM.workspace))
            .where(ApplicationORM.id == application.id)
        )
        application_orm = self._session.scalars(statement).first()
        if application_orm is None:
            return None

        application_orm.key = application.key
        application_orm.name = application.name
        application_orm.description = application.description

        workspace = application.workspace
        if workspace is not None and application_orm.workspace is not None:
            workspace_orm = application_orm.workspace
            workspace_orm.status = workspace.status
            workspace_orm.postgres_schema = workspace.postgres_schema
            workspace_orm.minio_namespace = workspace.minio_namespace
            workspace_orm.fuseki_dataset = workspace.fuseki_dataset
            workspace_orm.qdrant_collection = workspace.qdrant_collection
            workspace_orm.metadata_domain = workspace.metadata_domain
            workspace_orm.ontology_namespace = workspace.ontology_namespace
            workspace_orm.agent_namespace = workspace.agent_namespace
            workspace_orm.product_registry_namespace = workspace.product_registry_namespace
            workspace_orm.agent_registry_namespace = workspace.agent_registry_namespace

        self._commit_or_raise_duplicate()
        self._session.refresh(application_orm)
        return _to_domain_application(application_orm)

    def delete(self, application_id: UUID) -> bool:
        statement = select(ApplicationORM).where(ApplicationORM.id == application_id)
        application_orm = self._session.scalars(statement).first()
        if application_orm is None:
            return False
        self._session.delete(application_orm)
        self._session.commit()
        return True

    def _commit_or_raise_duplicate(self) -> None:
        try:
            self._session.commit()
        except IntegrityError as error:
            self._session.rollback()
            raise DuplicateApplicationKeyError("Application key already exists") from error
