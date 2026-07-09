"""HTTP adapter for :class:`WebContentPort`."""

from __future__ import annotations

import httpx

from app.shared.ports.web_content import DEFAULT_WEB_CONTENT_MAX_BYTES
from app.shared.web_content import WebContentFetchError, validate_fetch_url


class HttpWebContentAdapter:
    """Fetches remote text content over HTTP using httpx."""

    def __init__(
        self,
        *,
        timeout: float = 30.0,
        max_bytes: int = DEFAULT_WEB_CONTENT_MAX_BYTES,
    ) -> None:
        self._timeout = timeout
        self._max_bytes = max_bytes

    def fetch_text(
        self,
        *,
        url: str,
        max_bytes: int | None = None,
    ) -> str:
        normalized = validate_fetch_url(url)
        limit = self._max_bytes if max_bytes is None else max_bytes
        try:
            with (
                httpx.Client(timeout=self._timeout, follow_redirects=True) as client,
                client.stream("GET", normalized) as response,
            ):
                response.raise_for_status()
                chunks: list[bytes] = []
                total = 0
                for chunk in response.iter_bytes():
                    total += len(chunk)
                    if total > limit:
                        raise WebContentFetchError(
                            f"URL content exceeds maximum size of {limit} bytes"
                        )
                    chunks.append(chunk)
                raw = b"".join(chunks)
        except WebContentFetchError:
            raise
        except httpx.HTTPError as error:
            raise WebContentFetchError(f"Failed to fetch URL: {error}") from error
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.decode("utf-8", errors="replace")