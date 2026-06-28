# Asset Registry Contract v1

**Status:** Authoritative supplement (Sprint 4)  
**Date:** 2026-06-28  
**Issue:** S4-01  
**Architecture references:** ARR-002, ARR-003, DM-005, R-013, API-003, D-011  
**Companion:** [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md)

---

## 1. Purpose

Define the **AssetRecord registry contract** that the `assets` module must implement before Sprint 4 **gate = Yes** Assets PRs merge to `develop`.

This document is binding for:

- `AssetRecord` aggregate shape (DM-005)
- Generic registry lifecycle (ARR-002 / Asset Catalog alignment for AssetRecord)
- Minimum REST API surface for Sprint 4 issues S4-02–S4-05

The registry **indexes** platform assets scoped to an Application; it does not replace module-owned aggregates (Blueprint, DiscoverySession, etc.).

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| AssetRecord fields (DM-005) | Physical adapter provisioning |
| Registry lifecycle status and transitions (S4-04) | Platform Console Asset Explorer UI |
| `/api/v1/assets` CRUD and status endpoints | Automatic registration from other modules (deferred) |
| Application 1:N registry entries | Connector / DataSource management |
| SemanticTransaction on create (S4-05) | TraceStep orchestration (S4-06+) |

---

## 3. Aggregate relationship

```
Application (DM-001)
└── AssetRecord (DM-005) — 1:N at MVP
    ├── asset_type + resource_type + resource_id (logical pointer)
    └── status (registry lifecycle)
```

- `AssetRecord.application_id` is required; FK to `applications.id`.
- Multiple AssetRecord rows may exist per application (one per registered asset entry).
- `resource_type` + `resource_id` identify the underlying platform resource (opaque string id at MVP).
- Owning modules (e.g. `blueprints`) remain authoritative for domain logic; this module stores registry metadata only.

---

## 4. AssetRecord aggregate (DM-005)

### 4.1 Required fields

| Field | Type (logical) | Required | Notes |
|-------|----------------|----------|-------|
| `id` | UUID | yes | Primary key |
| `application_id` | UUID | yes | FK to Application |
| `asset_type` | enum | yes | See §4.2 |
| `resource_type` | string | yes | Logical type label (e.g. `Blueprint`, `DiscoverySession`) |
| `resource_id` | string | yes | UUID string of referenced resource |
| `status` | enum | yes | See §5 |
| `title` | string | yes | Human-readable registry label |
| `description` | text | no | Optional summary |
| `created_by` | string | yes | Actor identifier (MVP opaque string) |
| `created_at` | datetime | yes | Row creation timestamp |
| `updated_at` | datetime | yes | Last mutation timestamp |
| `metadata` | JSON | no | Optional registry metadata blob |

### 4.2 asset_type (MVP subset)

MVP supports registration of cross-module references already on `develop`:

| `asset_type` | Typical `resource_type` | Notes |
|--------------|---------------------------|-------|
| `Application` | `Application` | Optional self-reference row |
| `DiscoverySession` | `DiscoverySession` | FK to discovery module |
| `Blueprint` | `Blueprint` | FK to blueprints module |

Additional Asset Catalog types (Ontology, KnowledgeGraph, DataProduct, Agent, etc.) are **documented for extension** but out of Sprint 4 implementation scope until owning modules exist.

### 4.3 Uniqueness (MVP)

At most one AssetRecord per `(application_id, resource_type, resource_id)` tuple. Duplicate create returns **409**.

---

## 5. Registry lifecycle (ARR-002)

Authoritative labels for **AssetRecord** (from ARR-002 resolution):

`Draft` → `Active` → `Published` → `Deprecated` → `Retired`

### 5.1 Transition matrix (S4-04)

| Current | Allowed next |
|---------|--------------|
| `Draft` | `Active` |
| `Active` | `Published`, `Draft` |
| `Published` | `Deprecated` |
| `Deprecated` | `Retired`, `Active` |
| `Retired` | *(none)* |

Invalid transitions return **422**.

---

## 6. ARR-004 alignment

Creating an AssetRecord **must not** create runtime semantic assets (ontologies, KG triples, data products, agents). Registry rows are metadata indexes only.

---

## 7. API and service expectations (Sprint 4)

| Layer | Responsibility |
|-------|----------------|
| `assets/api` | REST under `/api/v1/assets` |
| `assets/services` | CRUD, lifecycle validation, duplicate guard |
| `assets/repositories` | Persist AssetRecord rows |
| `assets/domain` | Models/enums; no FastAPI/SQLAlchemy |
| Ports | `TraceRecorder` for audit (S4-05) |

### 7.1 CRUD (S4-03)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/assets` | Create for `application_id`; status `Draft` |
| `GET` | `/api/v1/assets` | List; filter by `application_id`; optional `asset_type` |
| `GET` | `/api/v1/assets/{id}` | Get by id |
| `PATCH` | `/api/v1/assets/{id}` | Update title, description, metadata (not status) |

- `404` when `application_id` unknown.
- `409` on duplicate `(application_id, resource_type, resource_id)`.
- Register router in `api/v1/router.py` prefix `/assets`.

### 7.2 Status transitions (S4-04)

| Method | Path | Behavior |
|--------|------|----------|
| `PATCH` | `/api/v1/assets/{id}/status` | Body `{ "status": "..." }` per §5.1 |

### 7.3 Trace (R-013, S4-05)

| Field | Value |
|-------|-------|
| `transaction_type` | `asset.created` |
| `resource_type` | `AssetRecord` |
| `resource_id` | asset UUID |

Emit after successful persist on create.

---

## 8. Module boundaries

- `assets` owns AssetRecord APIs and persistence.
- `assets` validates Application existence via `applications` repository (read-only); does not expose Application CRUD.
- Other modules do not write `asset_records` directly at MVP; manual/API registration only.

---

## 9. Sprint 4 issue mapping

| Issue | Deliverable |
|-------|-------------|
| S4-01 | This contract (gate = No) |
| S4-02 | Domain models + migration |
| S4-03 | CRUD API |
| S4-04 | Lifecycle status endpoint |
| S4-05 | SemanticTransaction on create |

---

## 10. References

- SIP Asset Catalog v1 — authoritative lifecycle source (ARR-002)
- `SIP_Blueprint_Lifecycle_Contract_v1.md` — Blueprint as registrable asset type
- `SIP_Discovery_Workflow_Contract_v1.md` — DiscoverySession as registrable asset type
