"""Domain enumerations for the discovery module."""

from __future__ import annotations

from enum import IntEnum, StrEnum


class DiscoverySessionStatus(StrEnum):
    """Discovery session lifecycle states (DM-004 §5.2)."""

    ACTIVE = "Active"
    PAUSED = "Paused"
    COMPLETED = "Completed"
    ARCHIVED = "Archived"


class DiscoveryPhaseNumber(IntEnum):
    """Ordered discovery workflow phases 1–10 (DM-004 §4)."""

    INTENT_DISCOVERY = 1
    USER_DISCOVERY = 2
    KNOWLEDGE_DISCOVERY = 3
    BEHAVIOR_DISCOVERY = 4
    SEMANTIC_DISCOVERY = 5
    BLUEPRINT_DRAFT_GENERATION = 6
    HUMAN_REVIEW = 7
    SEMANTIC_DESIGN = 8
    APPLICATION_PROVISIONING = 9
    APPLICATION_EVOLUTION = 10


PHASE_NUMBER_TO_NAME: dict[DiscoveryPhaseNumber, str] = {
    DiscoveryPhaseNumber.INTENT_DISCOVERY: "Intent Discovery",
    DiscoveryPhaseNumber.USER_DISCOVERY: "User Discovery",
    DiscoveryPhaseNumber.KNOWLEDGE_DISCOVERY: "Knowledge Discovery",
    DiscoveryPhaseNumber.BEHAVIOR_DISCOVERY: "Behavior Discovery",
    DiscoveryPhaseNumber.SEMANTIC_DISCOVERY: "Semantic Discovery",
    DiscoveryPhaseNumber.BLUEPRINT_DRAFT_GENERATION: "Blueprint Draft Generation",
    DiscoveryPhaseNumber.HUMAN_REVIEW: "Human Review",
    DiscoveryPhaseNumber.SEMANTIC_DESIGN: "Semantic Design",
    DiscoveryPhaseNumber.APPLICATION_PROVISIONING: "Application Provisioning",
    DiscoveryPhaseNumber.APPLICATION_EVOLUTION: "Application Evolution",
}


def phase_name_for_number(phase_number: int) -> str:
    """Return the canonical phase name for a phase number."""
    return PHASE_NUMBER_TO_NAME[DiscoveryPhaseNumber(phase_number)]
