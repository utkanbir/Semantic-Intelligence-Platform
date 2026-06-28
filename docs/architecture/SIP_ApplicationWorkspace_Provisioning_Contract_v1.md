# ApplicationWorkspace Provisioning Contract v1

**Status:** Authoritative supplement (Sprint 1)  
**Date:** 2026-06-26  
**Issue:** S1-02  
**Architecture references:** ARR-001, ARR-004, DM-001, DM-002, D-010, D-011, D-031  
**Companion:** [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md)

---

## 1. Purpose

Define the **blank ApplicationWorkspace provisioning contract** that the `applications` module must implement before CRUD and API work merge to `develop`.

This document is binding for Sprint 1 **gate = Yes** Applications PRs. Backend implements against this contract; no alternate field set or provision-time semantic assets.

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| Nine namespace fields on `ApplicationWorkspace` (ARR-001) | Adapter implementations (MinIO, Fuseki, etc.) |
| Blank workspace rules (ARR-004) | Discovery, Blueprint, Ontology population |
| Namespace naming conventions | Kubernetes namespace creation (infra owns runtime) |
| Persistence expectations (ORM + migration) | Platform Console UI |
| Domain events at provision time (stub/minimal) | Full `audit_trace` UI |

---

## 3. Aggregate relationship

```
Application (DM-001)
└── ApplicationWorkspace (DM-002) — 1:1 at MVP
    └── nine namespace fields (this contract)
```

- One **Application** has exactly one **ApplicationWorkspace** at MVP.
- Provisioning runs when Application is created (or immediately after in same transaction/service call).
- `ApplicationWorkspace.application_id` is required and unique.

---

## 4. Required fields (ARR-001)

All nine fields are **required**, **non-null**, and **persisted** at provision time.

| Field | Type (logical) | Purpose |
|-------|----------------|---------|
| `postgres_schema` | string | PostgreSQL schema isolation per application |
| `minio_namespace` | string | Object storage bucket/prefix isolation |
| `fuseki_dataset` | string | RDF knowledge graph dataset name |
| `qdrant_collection` | string | Vector store collection name |
| `metadata_domain` | string | Metadata catalog domain (e.g. OpenMetadata) |
| `ontology_namespace` | string | Ontology registry namespace |
| `agent_namespace` | string | Agent definition registry namespace |
| `product_registry_namespace` | string | Published Data Product registry namespace |
| `agent_registry_namespace` | string | Agent runtime/registry namespace |

Additional workspace metadata (from ARR-001 model):

| Field | Notes |
|-------|-------|
| `id` | UUID primary key |
| `application_id` | FK to Application |
| `status` | Workspace lifecycle (align ARR-002 / Asset Catalog when exposed) |
| `created_at` / `updated_at` | Audit timestamps |

---

## 5. Namespace naming convention

Namespaces are **deterministic from Application identity** to avoid collisions on shared infrastructure (D-012, ADR-001).

**Recommended pattern** (MVP):

```text
{platform_prefix}_{application_slug}_{field_suffix}
```

| Field | Example (`application_slug = acme-assessment`) |
|-------|--------------------------------------------------|
| `postgres_schema` | `sip_acme_assessment` |
| `minio_namespace` | `sip-acme-assessment` |
| `fuseki_dataset` | `sip/acme-assessment` |
| `qdrant_collection` | `sip_acme_assessment` |
| `metadata_domain` | `sip-acme-assessment` |
| `ontology_namespace` | `sip.acme-assessment.ontology` |
| `agent_namespace` | `sip.acme-assessment.agents` |
| `product_registry_namespace` | `sip.acme-assessment.products` |
| `agent_registry_namespace` | `sip.acme-assessment.agent-runtime` |

**Rules:**

- Slug derives from Application name/key; normalize to lowercase, hyphen/underscore per store rules.
- Collisions must be rejected at create time (409 or domain error).
- Physical resource creation (schema, bucket, dataset) may be **deferred to adapter ports** — MVP may persist namespace strings first and provision infrastructure asynchronously; see §8.

---

## 6. Blank workspace rules (ARR-004)

Provisioning **must not** create domain semantic assets:

- No ontologies, knowledge graph content, data products, agents, or business assets
- No Discovery or Blueprint artifacts

Provisioning **may** create only:

- `Application` + `ApplicationWorkspace` records
- Namespace registration metadata (nine fields)
- System-level workspace records required for isolation tracking
- Optional empty catalog placeholders (no semantic content)

Post-provision: recommendation-based onboarding (D-031) — out of Sprint 1 API scope unless explicitly scheduled.

---

## 7. API and service expectations (Sprint 1)

| Layer | Responsibility |
|-------|----------------|
| `applications/api` | Expose Application CRUD; workspace returned as nested or sub-resource |
| `applications/services` | Orchestrate Application + blank Workspace in one use case |
| `applications/repositories` | Persist both aggregates |
| `applications/domain` | Models/enums; no FastAPI/SQLAlchemy imports |
| Ports | `RelationalDB` for persistence; future adapters for physical namespace provisioning |

**Minimum API surface (next issues):**

- `POST /api/v1/applications` — creates Application + ApplicationWorkspace with all nine fields
- `GET /api/v1/applications/{id}` — includes workspace namespace summary

---

## 8. Infrastructure provisioning phasing

| Phase | Behavior |
|-------|----------|
| **Sprint 1 MVP** | Persist namespace fields in PostgreSQL; `postgres_schema` may trigger schema creation via migration/adapter stub |
| **Later sprints** | Adapters module provisions MinIO, Fuseki, Qdrant, OpenMetadata per port interfaces |

Readiness: workspace is **logically provisioned** when DB row exists with nine fields; physical stores may lag if documented in service response (`provisioning_status` optional future field).

---

## 9. Events and trace (R-013)

Significant action: **ApplicationWorkspaceProvisioned** (or equivalent per `SIP_Domain_Events_v1`).

- Emit after successful persist of Application + Workspace
- Create **SemanticTransaction** + **TraceStep** (coordinate with `audit_trace` stub/minimal integration per Sprint 1 milestone)

Exact event names must match Domain Events doc when implementation PR opens.

---

## 10. Acceptance criteria (contract)

- [ ] All nine ARR-001 fields documented with naming rules (this document)
- [ ] ARR-004 blank workspace rules explicit
- [ ] Referenced by Applications module issues and gate = Yes PRs
- [ ] Architect review: fields match ARR-001 resolution doc

---

## 11. References

- [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md) — ARR-001, ARR-004
- [ADR-001](../adr/ADR-001-cloud-native-deployment-strategy.md) — Kubernetes-first runtime
- [SIP_GITHUB_WORKFLOW.md](../project/SIP_GITHUB_WORKFLOW.md) — Sprint 1 milestone §16
- Canonical `.docx`: `architecture/SIP_Domain_Model_v1`, `SIP_Implementation_Guide_v1`
