"""Domain enumerations for the governance module."""

from __future__ import annotations

from enum import StrEnum


class PolicyDefinitionStatus(StrEnum):
    """PolicyDefinition lifecycle states (DM-010, ARR-002)."""

    DRAFT = "Draft"
    APPROVED = "Approved"
    ACTIVE = "Active"
    RETIRED = "Retired"
