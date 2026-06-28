"""Domain enumerations for the blueprints module."""

from __future__ import annotations

from enum import StrEnum


class BlueprintStatus(StrEnum):
    """Blueprint lifecycle states (DM-003, ARR-002)."""

    DRAFT = "Draft"
    REVIEW = "Review"
    APPROVED = "Approved"
    VERSIONED = "Versioned"
    RETIRED = "Retired"
