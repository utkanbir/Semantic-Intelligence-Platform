"""Dev stub implementations for technology ports (R-018)."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.shared.ports.knowledge_graph import KnowledgeGraphPort
from app.shared.ports.llm import LLMPort
from app.shared.ports.object_storage import ObjectStoragePort
from app.shared.ports.relational_db import RelationalDBPort
from app.shared.ports.vector_store import VectorStorePort


class SqlAlchemyRelationalDBStub:
    """RelationalDB stub that pings the current SQLAlchemy session."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def ping(self) -> dict[str, str]:
        self._session.execute(text("SELECT 1"))
        return {"status": "ok", "technology": "postgresql"}


class ObjectStorageStub:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "technology": "minio"}


class KnowledgeGraphStub:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "technology": "fuseki"}


class VectorStoreStub:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "technology": "qdrant"}


class LLMStub:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "technology": "openai"}


class OpenMetadataStub:
    def ping(self) -> dict[str, str]:
        return {"status": "ok", "technology": "openmetadata"}


class AdapterFactory:
    """Resolve dev stub port implementations by technology type."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def ping(self, technology_type: str) -> dict[str, str]:
        port = self._resolve(technology_type)
        return port.ping()

    def _resolve(
        self, technology_type: str
    ) -> RelationalDBPort | ObjectStoragePort | KnowledgeGraphPort | VectorStorePort | LLMPort:
        if technology_type == "postgresql":
            return SqlAlchemyRelationalDBStub(self._session)
        if technology_type == "minio":
            return ObjectStorageStub()
        if technology_type == "fuseki":
            return KnowledgeGraphStub()
        if technology_type == "qdrant":
            return VectorStoreStub()
        if technology_type == "openai":
            return LLMStub()
        if technology_type == "openmetadata":
            return OpenMetadataStub()
        raise ValueError(f"Unsupported technology type: {technology_type}")
