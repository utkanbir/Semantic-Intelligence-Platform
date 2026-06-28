# Published Data Product Contract v1

**Status:** Authoritative supplement (Sprint 5)  
**Date:** 2026-06-28  
**Issue:** S5-01 (#90)  
**Architecture references:** ARR-002, ARR-003, ARR-004, DM-008, D-003, R-013, API-003  
**Companion:** [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md)

---

## 1. Purpose

Define the **PublishedDataProduct lifecycle contract** that the `products` module must implement before Sprint 5 **gate = Yes** Products PRs merge to `develop`.

This document is binding for:

- `PublishedDataProduct` aggregate shape (DM-008)
- Lifecycle states per Asset Catalog (ARR-002)
- Immutable `product_definition` and versioning metadata
- Minimum REST API surface for Sprint 5 issues S5-02–S5-06
- Agent consumption boundary (D-003) — only `Published` or `Versioned` rows are consumable

Backend implements against this contract; no alternate status enum or mutable versioned definitions.

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| PublishedDataProduct fields (DM-008) | Physical adapter / warehouse provisioning |
| Status enum and transition matrix (S5-04) | Platform Console Product Catalog UI |
| Immutable definition rules (S5-05) | Agent runtime execution (Sprint 6+) |
| Version fork API contract (S5-05) | Automatic product generation from Blueprint |
| `/api/v1/products` CRUD and status/version endpoints | MCP or external product APIs |
| Application and AssetRecord linkage (logical) | Full OpenMetadata sync |
| SemanticTransaction on create (S5-06) | TraceStep orchestration beyond existing port |

---

## 3. Aggregate relationship

```
Application (DM-001)
└── PublishedDataProduct (DM-008) — 1:N at MVP (multiple versions per application)
    ├── version_number, previous_version_id (version chain)
    ├── product_definition (immutable JSON once Versioned)
    └── source_asset_record_ids (logical references to AssetRecord rows)

AssetRecord (DM-005)
└── referenced by PublishedDataProduct.source_asset_record_ids (0:N at MVP)
```

- `PublishedDataProduct.application_id` is required; FK to `applications.id`.
- Multiple PublishedDataProduct rows may exist per application (version lineage).
- `source_asset_record_ids` is a JSON array of UUID strings referencing `asset_records.id` within the same application (validated at service layer).
- Agents (Sprint 6+) **must** consume products via this module's published interfaces, not raw storage (D-003).

---

## 4. PublishedDataProduct aggregate (DM-008)

### 4.1 Required fields

| Field | Type (logical) | Required | Notes |
|-------|----------------|----------|-------|
| `id` | UUID | yes | Primary key |
| `application_id` | UUID | yes | FK to Application |
| `version_number` | int | yes | Starts at `1`; increments on version fork |
| `previous_version_id` | UUID | no | Null for first version; FK to prior PublishedDataProduct |
| `status` | enum | yes | See §5 |
| `title` | string | yes | Human-readable product name |
| `description` | text | no | Product summary |
| `created_by` | string | yes | Actor identifier (MVP opaque string) |
| `created_at` | datetime | yes | Row creation timestamp |
| `updated_at` | datetime | yes | Last mutation timestamp |
| `certified_at` | datetime | no | Set when status → Certified |
| `published_at` | datetime | no | Set when status → Published |
| `version_created_at` | datetime | no | Set when forked from parent (S5-05) |
| `product_definition` | JSON | yes | Schema + field metadata; see §4.2 |
| `source_asset_record_ids` | JSON array | yes | UUID strings; may be `[]` at create |

### 4.2 product_definition (MVP stub)

At MVP, `product_definition` is a JSON object describing consumable shape:

```json
{
  "schema_version": "1",
  "fields": [],
  "quality_rules": [],
  "access_policy": {},
  "metadata": {}
}
```

Create may persist `{}` or the stub above. Rich schema validation is deferred.

### 4.3 Consumption eligibility (D-003)

| Status | Agent-consumable? |
|--------|-------------------|
| `Draft`, `Certified` | **No** |
| `Published`, `Versioned` | **Yes** |
| `Retired` | **No** |

Sprint 5 implements persistence and lifecycle only; agent runtime enforcement is Sprint 6+.

---

## 5. Lifecycle status (ARR-002)

Authoritative labels from SIP Asset Catalog v1 (ARR-002 resolution):

| Value | Meaning |
|-------|---------|
| `Draft` | Editable product definition in progress |
| `Certified` | Quality/governance check passed |
| `Published` | Available for agent consumption (D-003) |
| `Versioned` | Immutable published version |
| `Retired` | Historical; not consumable |

### 5.1 Transition matrix (MVP)

| From | Allowed targets |
|------|-----------------|
| `Draft` | `Certified` |
| `Certified` | `Published`, `Draft` (send back) |
| `Published` | `Versioned` |
| `Versioned` | `Retired` |
| `Retired` | *(none — terminal)* |

- Invalid transitions return **422**.
- `certified_at` is set when entering `Certified` (if not already set).
- `published_at` is set when entering `Published` (if not already set).
- Entering `Versioned` locks `product_definition` (§6).

### 5.2 Version fork (S5-05)

From a parent in `Published` or `Versioned`:

- Create **new** PublishedDataProduct row (do not mutate parent).
- `version_number` = parent.`version_number` + 1
- `previous_version_id` = parent.`id`
- `version_created_at` = now
- `status` = `Draft`
- `product_definition` copied from parent or supplied in request body (new content allowed in Draft)
- `source_asset_record_ids` copied from parent unless overridden in body

Parent row and definition remain unchanged.

---

## 6. Definition immutability

| Status | `product_definition` / `source_asset_record_ids` mutable via PATCH? |
|--------|---------------------------------------------------------------------|
| `Draft`, `Certified`, `Published` | **Yes** — scalar fields and JSON blobs |
| `Versioned`, `Retired` | **No** — definition and lifecycle fields locked |

- Once `Versioned`, attempts to PATCH definition, sources, or status (except to `Retired`) return **422**.
- Immutability supports product version history and agent pinning (DM-008).

---

## 7. ARR-004 alignment

Creating a PublishedDataProduct **must not** provision runtime semantic assets (ontologies, KG triples, physical tables, agents). Product rows are governed metadata describing consumable interfaces; materialization is deferred to adapter modules.

Linking `source_asset_record_ids` validates AssetRecord existence only; it does not copy underlying module data.

---

## 8. API and service expectations (Sprint 5)

| Layer | Responsibility |
|-------|----------------|
| `products/api` | REST under `/api/v1/products` |
| `products/services` | Lifecycle, versioning, asset FK validation |
| `products/repositories` | Persist PublishedDataProduct rows |
| `products/domain` | Models/enums; no FastAPI/SQLAlchemy |
| Ports | `TraceRecorder` for audit (S5-06) |

### 8.1 CRUD (S5-03)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/products` | Create for `application_id`; status `Draft`; `version_number=1` |
| `GET` | `/api/v1/products` | List; filter by `application_id`; optional `status` |
| `GET` | `/api/v1/products/{id}` | Get by id |
| `PATCH` | `/api/v1/products/{id}` | Update title, description, definition, sources (if mutable) |

- `404` when `application_id` or referenced AssetRecord unknown.
- `422` when AssetRecord belongs to a different application.
- Register router in `api/v1/router.py` prefix `/products`.

### 8.2 Status transitions (S5-04)

| Method | Path | Behavior |
|--------|------|----------|
| `PATCH` | `/api/v1/products/{id}/status` | Body `{ "status": "..." }` per §5.1 |

### 8.3 Version fork (S5-05)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/products/{id}/versions` | New version row per §5.2; optional definition/sources in body |

### 8.4 Trace (R-013, S5-06)

| Field | Value |
|-------|-------|
| `transaction_type` | `product.created` |
| `resource_type` | `PublishedDataProduct` |
| `resource_id` | product UUID |

Emit after successful persist on create.

---

## 9. Module boundaries

- `products` owns PublishedDataProduct APIs and persistence.
- `applications` is read-only for FK validation.
- `assets` is read-only for `source_asset_record_ids` validation; products does not expose AssetRecord CRUD.
- Do not expose product routes from `applications/api` or `assets/api`.
- `agents` module (Sprint 6+) reads published products through `products` ports/repositories, not raw tables.

---

## 10. Sprint 5 issue mapping

| Issue | Deliverable |
|-------|-------------|
| S5-01 | This contract (gate = No) |
| S5-02 | Domain models + migration |
| S5-03 | CRUD API |
| S5-04 | Lifecycle status endpoint |
| S5-05 | Version fork endpoint |
| S5-06 | SemanticTransaction on create |

---

## 11. Acceptance criteria (architect review)

- [ ] DM-008 fields complete
- [ ] ARR-002 status enum and transition matrix (§5)
- [ ] D-003 consumption eligibility (§4.3)
- [ ] Definition immutability when Versioned (§6)
- [ ] Version fork rules (§5.2)
- [ ] API paths for S5-02–S5-06 (§8)
- [ ] ARR-004 no runtime assets at create

---

## 12. References

- SIP Domain Model v1 — DM-008
- SIP Asset Catalog v1 — PublishedDataProduct lifecycle
- [SIP_Asset_Registry_Contract_v1.md](./SIP_Asset_Registry_Contract_v1.md) — source AssetRecord linkage
- [SIP_ApplicationWorkspace_Provisioning_Contract_v1.md](./SIP_ApplicationWorkspace_Provisioning_Contract_v1.md) — `product_registry_namespace`
