"""Applications module."""

# Import domain models so ORM tables register on shared metadata.
from app.modules.applications.domain import Application, ApplicationWorkspace

__all__ = ["Application", "ApplicationWorkspace"]
