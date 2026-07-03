"""Connector key slug generation for technology adapters."""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

_SLUG_REPLACEMENTS = re.compile(r"[\s_]+")
_SLUG_INVALID = re.compile(r"[^a-z0-9-]+")
_SLUG_DASHES = re.compile(r"-{2,}")


def slugify_connector_part(value: str) -> str:
    """Normalize a string to lowercase alphanumeric segments separated by dashes."""
    normalized = value.strip().lower()
    normalized = _SLUG_REPLACEMENTS.sub("-", normalized)
    normalized = _SLUG_INVALID.sub("-", normalized)
    normalized = _SLUG_DASHES.sub("-", normalized)
    return normalized.strip("-")


def generate_connector_key(
    *,
    title: str,
    vendor: str | None = None,
) -> str:
    """Build a connector key slug from title and optional vendor."""
    title_slug = slugify_connector_part(title)
    if not title_slug:
        msg = "Title must contain at least one alphanumeric character"
        raise ValueError(msg)

    if not vendor:
        return title_slug

    vendor_slug = slugify_connector_part(vendor)
    if not vendor_slug or title_slug.endswith(vendor_slug):
        return title_slug

    return f"{title_slug}-{vendor_slug}"


def read_vendor_from_configuration(configuration: dict[str, Any] | None) -> str | None:
    vendor = (configuration or {}).get("vendor")
    return vendor if isinstance(vendor, str) and vendor.strip() else None


def resolve_unique_connector_key(
    *,
    title: str,
    adapter_configuration: dict[str, Any] | None,
    key_exists: Callable[[str], bool],
) -> str:
    """Generate a connector key, appending -2, -3, … on collision."""
    vendor = read_vendor_from_configuration(adapter_configuration)
    base_key = generate_connector_key(title=title, vendor=vendor)
    candidate = base_key
    suffix = 2
    while key_exists(candidate):
        candidate = f"{base_key}-{suffix}"
        suffix += 1
    return candidate
