# TD-006 — Unified Connectors and Ontology Transaction Orchestration (Sprint 27)

## Decision

Platform **Connector** is a single registry concept — no separate “semantic connector” or “infrastructure adapter” in UI or API terminology.

| Concern | Backend aggregate | API |
|---------|-------------------|-----|
| Connector registry | `TechnologyAdapter` (table `technology_adapters`) | `/api/v1/connectors` (alias `/adapters`) |

**Connector types** (platform categories, not vendor names):

- `database`
- `object_storage`
- `file_system`
- `ontology_knowledge_graph`

**Connector configuration** (`connector_configuration` JSON, schema v2):

- `vendor` — e.g. `postgresql`, `apache_fuseki`, `minio`
- `connection_method` — `existing_instance` | `provision_in_cluster` (K8s provisioning deferred to Sprint 28+)
- `connection` — vendor-specific host/endpoint/credentials fields

Ontology create/import/status/fork operations record **SemanticTransaction** rows with `application_id` and ordered **TraceSteps**. Ontology import binds to an **Active** connector where `connector_type = ontology_knowledge_graph` via `ontology_definitions.connector_id` → `technology_adapters.id`.

## API surface

- `POST/GET/PATCH /api/v1/connectors` — connector CRUD, lifecycle, ping
- `POST /api/v1/ontologies/import` — `connector_id` references unified connector registry
- `GET /api/v1/audit-traces?application_id=` (+ optional `resource_type`, `transaction_type_prefix`)

## Console

- **Platform → Connectors** — single page: type, vendor, connection method, connection details
- **Application → Ontology Studio** — import via Active ontology/knowledge-graph connector
- **Application → Audit trace** — app-scoped semantic transactions

## Migrations (Sprint 27)

| Revision | Change |
|----------|--------|
| `20260702_0016` | `application_id` on `semantic_transactions`; ontology import fields |
| `20260703_0017` | `technology_type` → `connector_type`; ontology FK → `technology_adapters` |
| `20260704_0018` | Drop deprecated `semantic_connectors` table |

## Deferred

- Kubernetes connector provisioning (`provision_in_cluster`) — partial; see Sprint 28
- OpenMetadata sync
- Full ObjectStorage artifact pipeline beyond ontology materialize

## Shipped since original deferral (update 2026-07-08)

| Former deferral | Shipped in | Notes |
|-----------------|------------|-------|
| Real Fuseki artifact write | Sprint 30+ | `POST /ontologies/{id}/materialize` writes to named graph |
| LLM document extraction | Sprint 34–35 | Generate-from-Sources mode + URL/CSV sources |
| Ontology import → immediate graph write | Sprint 34 | Replaced by draft-first; materialize after approve |

Current Console flow: **Ontology Studio wizard** at `/applications/:id/ontology/create` — not import-only.

## Gate

Architecture gate **Yes** — approved for Sprint 27 MVP scope above.
