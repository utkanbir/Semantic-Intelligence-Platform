"""SQLAlchemy repository implementations for the governance module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.governance.domain.enums import PolicyDefinitionStatus
from app.modules.governance.domain.models import PolicyDefinition
from app.modules.governance.repositories.interfaces import PolicyDefinitionRepository
from app.modules.governance.repositories.orm_models import (
    PolicyDefinition as PolicyDefinitionORM,
)


def _to_domain(policy_orm: PolicyDefinitionORM) -> PolicyDefinition:
    return PolicyDefinition(
        id=policy_orm.id,
        policy_key=policy_orm.policy_key,
        status=PolicyDefinitionStatus(policy_orm.status),
        title=policy_orm.title,
        description=policy_orm.description,
        created_by=policy_orm.created_by,
        created_at=policy_orm.created_at,
        updated_at=policy_orm.updated_at,
        approved_at=policy_orm.approved_at,
        activated_at=policy_orm.activated_at,
        retired_at=policy_orm.retired_at,
        policy_definition=policy_orm.policy_definition or {},
    )


class SqlAlchemyPolicyDefinitionRepository(PolicyDefinitionRepository):
    """SQLAlchemy-backed implementation for policy definition persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, policy: PolicyDefinition) -> PolicyDefinition:
        policy_orm = PolicyDefinitionORM(
            id=policy.id,
            policy_key=policy.policy_key,
            status=policy.status.value,
            title=policy.title,
            description=policy.description,
            created_by=policy.created_by,
            created_at=policy.created_at,
            updated_at=policy.updated_at,
            approved_at=policy.approved_at,
            activated_at=policy.activated_at,
            retired_at=policy.retired_at,
            policy_definition=policy.policy_definition,
        )
        self._session.add(policy_orm)
        self._session.commit()
        self._session.refresh(policy_orm)
        return _to_domain(policy_orm)

    def list_all(self, *, status: str | None = None) -> Sequence[PolicyDefinition]:
        statement = select(PolicyDefinitionORM).order_by(PolicyDefinitionORM.created_at.desc())
        if status is not None:
            statement = statement.where(PolicyDefinitionORM.status == status)
        return [_to_domain(item) for item in self._session.scalars(statement).all()]

    def get(self, policy_id: UUID) -> PolicyDefinition | None:
        policy_orm = self._session.get(PolicyDefinitionORM, policy_id)
        return _to_domain(policy_orm) if policy_orm else None

    def get_by_key(self, policy_key: str) -> PolicyDefinition | None:
        statement = select(PolicyDefinitionORM).where(
            PolicyDefinitionORM.policy_key == policy_key
        )
        policy_orm = self._session.scalars(statement).first()
        return _to_domain(policy_orm) if policy_orm else None

    def update(self, policy: PolicyDefinition) -> PolicyDefinition | None:
        policy_orm = self._session.get(PolicyDefinitionORM, policy.id)
        if policy_orm is None:
            return None
        policy_orm.policy_key = policy.policy_key
        policy_orm.status = policy.status.value
        policy_orm.title = policy.title
        policy_orm.description = policy.description
        policy_orm.updated_at = policy.updated_at
        policy_orm.approved_at = policy.approved_at
        policy_orm.activated_at = policy.activated_at
        policy_orm.retired_at = policy.retired_at
        policy_orm.policy_definition = policy.policy_definition
        self._session.commit()
        self._session.refresh(policy_orm)
        return _to_domain(policy_orm)
