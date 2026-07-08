"""Canonical technology port protocols (R-018)."""

from app.shared.ports.knowledge_graph import KnowledgeGraphPort
from app.shared.ports.llm import LLMPort
from app.shared.ports.object_storage import ObjectStoragePort
from app.shared.ports.relational_db import RelationalDBPort
from app.shared.ports.vector_store import VectorStorePort
from app.shared.ports.web_content import WebContentPort

__all__ = [
    "KnowledgeGraphPort",
    "LLMPort",
    "ObjectStoragePort",
    "RelationalDBPort",
    "VectorStorePort",
    "WebContentPort",
]
