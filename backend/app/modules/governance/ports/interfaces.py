"""Port interfaces for the governance module."""

from __future__ import annotations

from typing import Protocol


class TraceRecorder(Protocol):
    """Outbound port for recording semantic transactions."""

    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        """Persist one semantic transaction record."""
