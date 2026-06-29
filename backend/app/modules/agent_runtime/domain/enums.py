"""Domain enumerations for the agent_runtime module."""

from __future__ import annotations

from enum import StrEnum


class AgentRunStatus(StrEnum):
    """AgentRun lifecycle states (Sprint 8 stub)."""

    PENDING = "Pending"
    RUNNING = "Running"
    COMPLETED = "Completed"
    FAILED = "Failed"
