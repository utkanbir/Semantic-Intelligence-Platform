"""Apache Jena Fuseki adapter for KnowledgeGraphPort."""

from __future__ import annotations

import base64
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.modules.adapters.services.connector_provision import read_provision_block


class FusekiImportError(Exception):
    """Raised when Fuseki RDF import fails."""


def read_fuseki_endpoint(configuration: dict[str, Any]) -> str:
    provision = read_provision_block(configuration)
    if provision is not None:
        endpoint = provision.get("endpoint")
        if isinstance(endpoint, str) and endpoint:
            return endpoint.rstrip("/")

    connection = configuration.get("connection")
    if isinstance(connection, dict):
        endpoint = connection.get("endpoint")
        if isinstance(endpoint, str) and endpoint:
            return endpoint.rstrip("/")

    endpoint = configuration.get("endpoint")
    if isinstance(endpoint, str) and endpoint:
        return endpoint.rstrip("/")

    raise FusekiImportError("Fuseki endpoint is not configured on connector")


def read_fuseki_credentials(configuration: dict[str, Any]) -> tuple[str | None, str | None]:
    connection = configuration.get("connection")
    if not isinstance(connection, dict):
        return None, None
    username = connection.get("username")
    password = connection.get("password")
    return (
        username if isinstance(username, str) and username else None,
        password if isinstance(password, str) and password else None,
    )


class FusekiKnowledgeGraphAdapter:
    """HTTP adapter for Apache Fuseki dataset import."""

    def __init__(self, configuration: dict[str, Any]) -> None:
        self._configuration = configuration
        self._endpoint = read_fuseki_endpoint(configuration)

    def ping(self) -> dict[str, str]:
        url = f"{self._endpoint}/$/ping"
        headers: dict[str, str] = {}
        username, password = read_fuseki_credentials(self._configuration)
        if username and password:
            token = base64.b64encode(f"{username}:{password}".encode()).decode("ascii")
            headers["Authorization"] = f"Basic {token}"

        request = Request(url, headers=headers, method="GET")
        try:
            with urlopen(request, timeout=15) as response:
                status = getattr(response, "status", 200)
        except HTTPError as error:
            raise FusekiImportError(
                f"Fuseki ping failed with HTTP {error.code}: {error.reason}"
            ) from error
        except URLError as error:
            raise FusekiImportError(f"Fuseki ping request failed: {error.reason}") from error

        if status not in {200, 204}:
            raise FusekiImportError(f"Fuseki ping failed with HTTP {status}")

        return {
            "status": "ok",
            "connector_type": "ontology_knowledge_graph",
            "endpoint": self._endpoint,
        }

    def import_data(
        self, *, dataset: str, content: str, content_type: str
    ) -> dict[str, str]:
        url = f"{self._endpoint}/{dataset}/data"
        headers = {"Content-Type": content_type}
        username, password = read_fuseki_credentials(self._configuration)
        if username and password:
            token = base64.b64encode(f"{username}:{password}".encode()).decode("ascii")
            headers["Authorization"] = f"Basic {token}"

        request = Request(
            url,
            data=content.encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=30) as response:
                status = getattr(response, "status", 200)
        except HTTPError as error:
            raise FusekiImportError(
                f"Fuseki import failed with HTTP {error.code}: {error.reason}"
            ) from error
        except URLError as error:
            raise FusekiImportError(f"Fuseki import request failed: {error.reason}") from error

        if status not in {200, 201, 204}:
            raise FusekiImportError(f"Fuseki import failed with HTTP {status}")

        return {
            "status": "imported",
            "location": url,
            "dataset": dataset,
            "endpoint": self._endpoint,
        }
