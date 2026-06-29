"""Domain enumerations for the agents module."""

from __future__ import annotations

from enum import StrEnum


class AgentDefinitionStatus(StrEnum):
    """AgentDefinition lifecycle states (DM-009, ARR-002)."""

    DRAFT = "Draft"
    APPROVED = "Approved"
    ACTIVE = "Active"
    VERSIONED = "Versioned"
    RETIRED = "Retired"
