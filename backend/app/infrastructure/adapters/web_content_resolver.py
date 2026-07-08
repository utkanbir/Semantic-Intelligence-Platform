"""Resolve WebContentPort implementations from application settings."""

from __future__ import annotations

from app.infrastructure.adapters.http_web_content import HttpWebContentAdapter
from app.shared.ports.web_content import WebContentPort


def resolve_web_content_port() -> WebContentPort:
    """Return the configured web content port."""
    return HttpWebContentAdapter()
