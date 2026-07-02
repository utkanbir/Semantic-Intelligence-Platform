"""Dev stub implementations for technology ports (R-018)."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.shared.ports.knowledge_graph import KnowledgeGraphPort
from app.shared.ports.object_storage import ObjectStoragePort
from app.shared.ports.relational_db import RelationalDBPort


class SqlAlchemyRelationalDBStub:
    """RelationalDB stub that pings the current SQLAlchemy session."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def ping(self) -> dict[str, str]:
        self._session.execute(text("SELECT 1"))
        return {"status": "ok", "connector_type": "database"}


class ObjectStorageStub:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "connector_type": "object_storage"}


class KnowledgeGraphStub:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "connector_type": "ontology_knowledge_graph"}


class FileSystemStub:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "connector_type": "file_system"}


class AdapterFactory:
    """Resolve dev stub port implementations by connector type."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def ping(self, connector_type: str) -> dict[str, str]:
        port = self._resolve(connector_type)
        return port.ping()

    def _resolve(
        self, connector_type: str
    ) -> RelationalDBPort | ObjectStoragePort | KnowledgeGraphPort:
        if connector_type == "database":
            return SqlAlchemyRelationalDBStub(self._session)
        if connector_type in {"object_storage", "file_system"}:
            return ObjectStorageStub()
        if connector_type == "ontology_knowledge_graph":
            return KnowledgeGraphStub()
        raise ValueError(f"Unsupported connector type: {connector_type}")
