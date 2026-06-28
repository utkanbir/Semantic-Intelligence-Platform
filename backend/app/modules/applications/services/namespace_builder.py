"""Namespace builder for ApplicationWorkspace provisioning contract."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class NamespaceFields:
    """All contract-required namespace fields for one application."""

    postgres_schema: str
    minio_namespace: str
    fuseki_dataset: str
    qdrant_collection: str
    metadata_domain: str
    ontology_namespace: str
    agent_namespace: str
    product_registry_namespace: str
    agent_registry_namespace: str


def slugify_application_key(key: str) -> str:
    """Normalize an application key to the canonical slug format."""
    normalized = key.strip().lower()
    normalized = re.sub(r"[\s_]+", "-", normalized)
    normalized = re.sub(r"[^a-z0-9-]+", "-", normalized)
    normalized = re.sub(r"-{2,}", "-", normalized)
    normalized = normalized.strip("-")
    if not normalized:
        msg = "Application key must contain at least one alphanumeric character"
        raise ValueError(msg)
    return normalized


def build_namespace_fields(key: str) -> NamespaceFields:
    """Build deterministic namespace values from an application key."""
    slug = slugify_application_key(key)
    snake_slug = slug.replace("-", "_")

    return NamespaceFields(
        postgres_schema=f"sip_{snake_slug}",
        minio_namespace=f"sip-{slug}",
        fuseki_dataset=f"sip/{slug}",
        qdrant_collection=f"sip_{snake_slug}",
        metadata_domain=f"sip-{slug}",
        ontology_namespace=f"sip.{slug}.ontology",
        agent_namespace=f"sip.{slug}.agents",
        product_registry_namespace=f"sip.{slug}.products",
        agent_registry_namespace=f"sip.{slug}.agent-runtime",
    )
