"""Health service helpers for platform probes."""

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


def check_database_readiness(db: Session) -> tuple[bool, str]:
    """Return database readiness status and detail message."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return False, "unreachable"
    return True, "reachable"
