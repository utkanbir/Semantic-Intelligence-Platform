"""Apache Jena Fuseki adapter for KnowledgeGraphPort."""

from __future__ import annotations

import base64
from typing import Any
from urllib.parse import quote, urlencode
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.modules.adapters.services.connector_provision import read_provision_block


class FusekiImportError(Exception):
    """Raised when Fuseki RDF import fails."""


def fuseki_dataset_service_path(dataset: str) -> str:
    """Map logical workspace dataset names to a single Fuseki URL segment."""
    return dataset.strip("/").replace("/", "-")


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


def _fuseki_auth_headers(configuration: dict[str, Any]) -> dict[str, str]:
    headers: dict[str, str] = {}
    username, password = read_fuseki_credentials(configuration)
    if username and password:
        token = base64.b64encode(f"{username}:{password}".encode()).decode("ascii")
        headers["Authorization"] = f"Basic {token}"
    return headers


def _format_fuseki_http_error(error: HTTPError, action: str) -> str:
    body = error.read().decode("utf-8", errors="replace").strip()
    message = f"{action} with HTTP {error.code}: {error.reason}"
    if body:
        message = f"{message} — {body[:500]}"
    return message


class FusekiKnowledgeGraphAdapter:
    """HTTP adapter for Apache Fuseki dataset import."""

    def __init__(self, configuration: dict[str, Any]) -> None:
        self._configuration = configuration
        self._endpoint = read_fuseki_endpoint(configuration)

    def ping(self) -> dict[str, str]:
        url = f"{self._endpoint}/$/ping"
        request = Request(url, headers=_fuseki_auth_headers(self._configuration), method="GET")
        try:
            with urlopen(request, timeout=15) as response:
                status = getattr(response, "status", 200)
        except HTTPError as error:
            raise FusekiImportError(_format_fuseki_http_error(error, "Fuseki ping failed")) from error
        except URLError as error:
            raise FusekiImportError(f"Fuseki ping request failed: {error.reason}") from error

        if status not in {200, 204}:
            raise FusekiImportError(f"Fuseki ping failed with HTTP {status}")

        return {
            "status": "ok",
            "connector_type": "ontology_knowledge_graph",
            "endpoint": self._endpoint,
        }

    def _ensure_dataset_exists(self, dataset_segment: str) -> None:
        headers = _fuseki_auth_headers(self._configuration)
        if "Authorization" not in headers:
            return

        dataset_url = f"{self._endpoint}/$/datasets/{quote(dataset_segment, safe='')}"
        check_request = Request(dataset_url, headers=headers, method="GET")
        try:
            with urlopen(check_request, timeout=15) as response:
                if getattr(response, "status", 200) == 200:
                    return
        except HTTPError as error:
            if error.code != 404:
                raise FusekiImportError(
                    _format_fuseki_http_error(error, "Fuseki dataset lookup failed")
                ) from error
        except URLError as error:
            raise FusekiImportError(
                f"Fuseki dataset lookup request failed: {error.reason}"
            ) from error

        create_body = urlencode(
            {"dbName": f"/{dataset_segment}", "dbType": "tdb2"}
        ).encode("utf-8")
        create_headers = {
            **_fuseki_auth_headers(self._configuration),
            "Content-Type": "application/x-www-form-urlencoded",
        }
        create_request = Request(
            f"{self._endpoint}/$/datasets",
            data=create_body,
            headers=create_headers,
            method="POST",
        )
        try:
            with urlopen(create_request, timeout=30) as response:
                status = getattr(response, "status", 200)
        except HTTPError as error:
            if error.code in {409, 422}:
                return
            raise FusekiImportError(
                _format_fuseki_http_error(error, "Fuseki dataset creation failed")
            ) from error
        except URLError as error:
            raise FusekiImportError(
                f"Fuseki dataset creation request failed: {error.reason}"
            ) from error

        if status not in {200, 201, 204}:
            raise FusekiImportError(f"Fuseki dataset creation failed with HTTP {status}")

    def import_data(
        self, *, dataset: str, content: str, content_type: str
    ) -> dict[str, str]:
        dataset_segment = fuseki_dataset_service_path(dataset)
        self._ensure_dataset_exists(dataset_segment)
        url = f"{self._endpoint}/{dataset_segment}/data"
        headers = {"Content-Type": content_type, **_fuseki_auth_headers(self._configuration)}

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
            raise FusekiImportError(_format_fuseki_http_error(error, "Fuseki import failed")) from error
        except URLError as error:
            raise FusekiImportError(f"Fuseki import request failed: {error.reason}") from error

        if status not in {200, 201, 204}:
            raise FusekiImportError(f"Fuseki import failed with HTTP {status}")

        return {
            "status": "imported",
            "location": url,
            "dataset": dataset,
            "dataset_segment": dataset_segment,
            "endpoint": self._endpoint,
        }

    def export_data(self, *, dataset: str, accept_format: str = "text/turtle") -> str:
        dataset_segment = fuseki_dataset_service_path(dataset)
        url = f"{self._endpoint}/{dataset_segment}/data"
        headers = {"Accept": accept_format, **_fuseki_auth_headers(self._configuration)}
        request = Request(url, headers=headers, method="GET")
        try:
            with urlopen(request, timeout=30) as response:
                status = getattr(response, "status", 200)
                body = response.read()
        except HTTPError as error:
            raise FusekiImportError(_format_fuseki_http_error(error, "Fuseki export failed")) from error
        except URLError as error:
            raise FusekiImportError(f"Fuseki export request failed: {error.reason}") from error

        if status not in {200, 204}:
            raise FusekiImportError(f"Fuseki export failed with HTTP {status}")

        return body.decode("utf-8")
