"""SQLAlchemy repository implementations for the blueprints module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.blueprints.domain.enums import BlueprintStatus
from app.modules.blueprints.domain.models import Blueprint
from app.modules.blueprints.repositories.interfaces import BlueprintRepository
from app.modules.blueprints.repositories.orm_models import Blueprint as BlueprintORM


def _to_domain(blueprint_orm: BlueprintORM) -> Blueprint:
    return Blueprint(
        id=blueprint_orm.id,
        application_id=blueprint_orm.application_id,
        version_number=blueprint_orm.version_number,
        previous_version_id=blueprint_orm.previous_version_id,
        status=BlueprintStatus(blueprint_orm.status),
        title=blueprint_orm.title,
        goal=blueprint_orm.goal,
        outcome=blueprint_orm.outcome,
        created_by=blueprint_orm.created_by,
        created_at=blueprint_orm.created_at,
        approved_at=blueprint_orm.approved_at,
        version_created_at=blueprint_orm.version_created_at,
        blueprint_snapshot=blueprint_orm.blueprint_snapshot or {},
    )


class SqlAlchemyBlueprintRepository(BlueprintRepository):
    """SQLAlchemy-backed implementation for blueprint persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, blueprint: Blueprint) -> Blueprint:
        blueprint_orm = BlueprintORM(
            id=blueprint.id,
            application_id=blueprint.application_id,
            version_number=blueprint.version_number,
            previous_version_id=blueprint.previous_version_id,
            status=blueprint.status.value,
            title=blueprint.title,
            goal=blueprint.goal,
            outcome=blueprint.outcome,
            created_by=blueprint.created_by,
            created_at=blueprint.created_at,
            approved_at=blueprint.approved_at,
            version_created_at=blueprint.version_created_at,
            blueprint_snapshot=blueprint.blueprint_snapshot,
        )
        self._session.add(blueprint_orm)
        self._session.commit()
        self._session.refresh(blueprint_orm)
        return _to_domain(blueprint_orm)

    def list_by_application(self, application_id: UUID) -> Sequence[Blueprint]:
        statement = (
            select(BlueprintORM)
            .where(BlueprintORM.application_id == application_id)
            .order_by(BlueprintORM.version_number.desc())
        )
        return [_to_domain(item) for item in self._session.scalars(statement).all()]

    def get(self, blueprint_id: UUID) -> Blueprint | None:
        blueprint_orm = self._session.get(BlueprintORM, blueprint_id)
        return _to_domain(blueprint_orm) if blueprint_orm else None

    def update(self, blueprint: Blueprint) -> Blueprint | None:
        blueprint_orm = self._session.get(BlueprintORM, blueprint.id)
        if blueprint_orm is None:
            return None

        blueprint_orm.status = blueprint.status.value
        blueprint_orm.title = blueprint.title
        blueprint_orm.goal = blueprint.goal
        blueprint_orm.outcome = blueprint.outcome
        blueprint_orm.approved_at = blueprint.approved_at
        blueprint_orm.version_created_at = blueprint.version_created_at
        blueprint_orm.blueprint_snapshot = blueprint.blueprint_snapshot

        self._session.commit()
        self._session.refresh(blueprint_orm)
        return _to_domain(blueprint_orm)
