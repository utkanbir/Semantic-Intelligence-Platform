# Technology Adapter Contract v1

**Status:** Authoritative supplement (Sprint 8)  
**Date:** 2026-06-29  
**Issue:** S8-01 (#128)  
**Architecture references:** ARR-002, ARR-003, ARR-004, R-018, R-013, API-003  
**Companion:** [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md)

---

## 1. Purpose

Define the **TechnologyAdapter registry contract** that the `adapters` module must implement before Sprint 8 **gate = Yes** Adapters PRs merge to `develop`.

Binding for:

- `TechnologyAdapter` aggregate shape (DM addendum — Sprint 8)
- Lifecycle per Asset Catalog (ARR-002): Registered → Configured → Active → Deprecated → Retired
- Canonical port interfaces (R-018) and in-process dev stubs for MVP technologies
- Minimum REST API for S8-02–S8-05

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| TechnologyAdapter registry persistence | Production secrets management (TD-001) |
| Port Protocol definitions (`RelationalDB`, `ObjectStorage`, `KnowledgeGraph`, `VectorStore`, `LLM`) | Full OpenMetadata / OpenAI client integration |
| Dev stub adapter implementations | Cross-cluster adapter deployment |
| `/api/v1/adapters` CRUD + status | MCP external APIs |
| SemanticTransaction on register (S8-05) | Physical workspace namespace provisioning |

---

## 3. Aggregate relationship

```
Platform (MVP)
└── TechnologyAdapter — 1:N registry rows
    ├── technology_type (postgresql | minio | fuseki | qdrant | openmetadata | openai)
    └── adapter_configuration (JSON — non-secret connection metadata)
```

- Adapters are **platform-scoped** at MVP (no `application_id` FK).
- Stub adapters satisfy ports for local/dev; modules never import vendor SDKs directly (R-018).

---

## 4. TechnologyAdapter aggregate

### 4.1 Required fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | yes | PK |
| `technology_type` | enum | yes | See §4.2 |
| `adapter_key` | string | yes | Unique logical key (e.g. `dev-postgresql`) |
| `status` | enum | yes | See §5 |
| `title` | string | yes | Display name |
| `description` | text | no | |
| `created_by` | string | yes | |
| `created_at` | datetime | yes | |
| `updated_at` | datetime | yes | |
| `configured_at` | datetime | no | |
| `activated_at` | datetime | no | |
| `deprecated_at` | datetime | no | |
| `retired_at` | datetime | no | |
| `adapter_configuration` | JSON | yes | Non-secret config stub |

### 4.2 technology_type (MVP)

| Value | Port |
|-------|------|
| `postgresql` | `RelationalDB` |
| `minio` | `ObjectStorage` |
| `fuseki` | `KnowledgeGraph` |
| `qdrant` | `VectorStore` |
| `openmetadata` | Metadata (future; stub only) |
| `openai` | `LLM` |

---

## 5. Lifecycle status (ARR-002)

| From | Allowed targets |
|------|-----------------|
| `Registered` | `Configured` |
| `Configured` | `Active`, `Registered` |
| `Active` | `Deprecated` |
| `Deprecated` | `Retired` |
| `Retired` | *(terminal)* |

---

## 6. Port interfaces (R-018)

Located under `app/shared/ports/`:

| Port | MVP stub behavior |
|------|-------------------|
| `RelationalDB` | `ping()` returns ok (wraps existing SQLAlchemy engine) |
| `ObjectStorage` | `ping()` no-op |
| `KnowledgeGraph` | `ping()` no-op |
| `VectorStore` | `ping()` no-op |
| `LLM` | `ping()` no-op |

`AdapterFactory` in `adapters` module resolves active adapter by `technology_type` for dev stubs.

---

## 7. API (Sprint 8)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/adapters` | Create; status `Registered` |
| `GET` | `/api/v1/adapters` | List; filter by `technology_type`, `status` |
| `GET` | `/api/v1/adapters/{id}` | Get |
| `PATCH` | `/api/v1/adapters/{id}` | Update title, description, configuration (if mutable) |
| `PATCH` | `/api/v1/adapters/{id}/status` | Lifecycle transition |
| `POST` | `/api/v1/adapters/{id}/ping` | Invoke stub port health check (Active only) |

### Trace

| Field | Value |
|-------|-------|
| `transaction_type` | `adapter.registered` |
| `resource_type` | `TechnologyAdapter` |

---

## 8. Module boundaries

- `adapters` owns TechnologyAdapter APIs, port stubs, and `AdapterFactory`.
- Business modules use ports only; no direct MinIO/Fuseki/Qdrant/OpenAI imports in `applications`, `products`, `agents`, etc.

---

## 9. Sprint 8 issue mapping

| Issue | Deliverable |
|-------|-------------|
| S8-01 | This contract |
| S8-02 | Shared ports + stub implementations |
| S8-03 | Domain + migration |
| S8-04 | CRUD + status + ping API |
| S8-05 | SemanticTransaction on register |

---

## 10. References

- SIP Asset Catalog v1 — Technology Adapter lifecycle
- ADR-001 — deployment vs adapter separation
