"""Domain enumerations for the assets module."""

from __future__ import annotations

from enum import StrEnum


class AssetType(StrEnum):
    """Registered asset types (DM-005 MVP subset)."""

    APPLICATION = "Application"
    DISCOVERY_SESSION = "DiscoverySession"
    BLUEPRINT = "Blueprint"


class AssetRecordStatus(StrEnum):
    """AssetRecord registry lifecycle (DM-005, ARR-002)."""

    DRAFT = "Draft"
    ACTIVE = "Active"
    PUBLISHED = "Published"
    DEPRECATED = "Deprecated"
    RETIRED = "Retired"
