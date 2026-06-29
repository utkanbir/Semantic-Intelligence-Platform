"""Domain enumerations for the products module."""

from __future__ import annotations

from enum import StrEnum


class PublishedDataProductStatus(StrEnum):
    """PublishedDataProduct lifecycle states (DM-008, ARR-002)."""

    DRAFT = "Draft"
    CERTIFIED = "Certified"
    PUBLISHED = "Published"
    VERSIONED = "Versioned"
    RETIRED = "Retired"
