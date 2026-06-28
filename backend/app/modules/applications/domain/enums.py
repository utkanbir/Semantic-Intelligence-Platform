"""Domain enumerations for the applications module."""

from __future__ import annotations

from enum import StrEnum


class ApplicationStatus(StrEnum):
    """ARR-002 application lifecycle states."""

    CREATED = "created"
    PROVISIONED = "provisioned"
    ACTIVE = "active"
    EVOLVING = "evolving"
    RETIRED = "retired"
