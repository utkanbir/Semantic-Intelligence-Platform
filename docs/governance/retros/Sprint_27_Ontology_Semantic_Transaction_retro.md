# Sprint Retrospective — Sprint 27

**Date:** 2026-07-02  
**Sprint:** Sprint 27 — Ontology Semantic Transaction v1 (unified Connectors)  
**Facilitator:** PMO (DM hat)

**Close gates:** `verify-sprint-close.ps1 -Sprint 27` **PASSED** (cluster DB + project board)

```
=== Sprint 27 close gates ===
--- Gate: Cluster DB ---
OK: alembic_head=20260704_0018
OK: 16 cumulative tables verified
--- Gate: Project board ---
OK: all 4 sprint issues are Done on project board.
ALL SPRINT CLOSE GATES PASSED for Sprint 27.
```

---

## 1. Committed vs delivered

| Issue | Title | Delivered | PR |
|-------|-------|-----------|-----|
| #260 | S27-01 Connector platform registry API | Done | #264 |
| #261 | S27-02 Ontology create/import SemanticTransaction orchestration | Done | #264 |
| #262 | S27-03 application_id on semantic_transactions + app-scoped audit API | Done | #264 |
| #263 | S27-04 Console Ontology Studio + Connectors UI | Done | #264 |

**Delivery rate:** 4/4 implementation issues.

**Mid-sprint pivot (PO-approved):** Separate “semantic connector” and “infrastructure adapter” UI/API dropped. Single **Connector** registry with platform types, vendor catalog, and connection configuration.

---

## 2. What went well

- **Unified Connector model** — `/connectors` with types `database`, `object_storage`, `file_system`, `ontology_knowledge_graph`; vendor + connection stored in `connector_configuration`.
- **Ontology orchestration** — create/import/status/fork record SemanticTransaction + TraceSteps with `application_id`.
- **Ontology Studio** — OWL import via Active ontology/knowledge-graph connector; audit trace scoped to application.
- **Cluster parity** — `sip-backend:s31`, `sip-console:s31`; Alembic through `20260704_0018`.
- **188 backend pytest**, **188 frontend vitest** green on `develop`.

---

## 3. What did not go well

- Initial sprint design introduced `semantic_connectors` table/module — superseded same sprint; extra migration churn (0016 create → 0018 drop).
- `fix-project-board.ps1` batch reconcile hit intermittent `Unknown status: Done`; manual `set-board-status.ps1` required for #261–#263.
- Stale console image on cluster blocked UI until rebuild (TD-016 pattern).
- `provision_in_cluster` connection method deferred — UI shows “coming soon” only.

---

## 4. Sprint 28 adjustments

- **Connector provisioning epic** — Kubernetes deploy path for vendor stacks (Fuseki, MinIO, etc.).
- Real artifact persistence (stub URI only today).
- Harden board sync / reduce batch-only reconciliation at sprint close.

---

## 9. Sprint 27 success criteria

| Criterion | Status |
|-----------|--------|
| Unified Connector registry API (`/connectors`) | **Met** |
| Ontology import with TraceSteps + `connector_id` | **Met** |
| App-scoped audit trace filter | **Met** |
| Console Connectors + Ontology Studio | **Met** |
| TD-006 supplement documented | **Met** |
| Sprint-close gates | **Met** |

---

## 10. End-user release notes

**Platform Console’da tek bir Connectors ekranından bağlantı kaydı oluşturabilir; uygulama içinde Ontology Studio ile OWL içeriği import edebilirsiniz.**

- **Platform → Connectors** — Tip (database, object storage, file system, ontology / knowledge graph), vendor, mevcut instance bağlantı bilgileri
- **Application → Ontology Studio** — Active ontology/knowledge-graph connector üzerinden OWL import
- **Application → Audit trace** — Uygulama kapsamlı semantic transaction listesi
- Erişim: **http://console.sip.local** (cluster `sip-console:s31`)

---

## 11. Technical deliverables

### REST endpoints

| Module | Path | Notes |
|--------|------|-------|
| connectors | `POST/GET/PATCH /api/v1/connectors` | Unified registry (alias `/adapters`) |
| connectors | `POST /api/v1/connectors/{id}/ping` | Stub ping by connector type |
| ontologies | `POST /api/v1/ontologies/import` | `connector_id` → `technology_adapters` |
| audit-traces | `GET /api/v1/audit-traces?application_id=` | Optional `resource_type`, `transaction_type_prefix` |

### Data models

| Change | Migration |
|--------|-----------|
| `semantic_transactions.application_id` | `20260702_0016` |
| `ontology_definitions.connector_id`, `artifact_uri`, `source_format` | `20260702_0016` → `20260703_0017` (FK to `technology_adapters`) |
| `technology_adapters.connector_type` (renamed from `technology_type`) | `20260703_0017` |
| Drop deprecated `semantic_connectors` | `20260704_0018` |

### Reports

| Document | Path |
|----------|------|
| TD-006 supplement (unified Connectors) | `docs/architecture/SIP_Semantic_Connector_Supplement_v1.md` |

### Infrastructure

| Item | Detail |
|------|--------|
| Dev overlay | `sip-backend:s31`, `sip-console:s31` |
| Postgres port-forward | `scripts/port-forward-postgres.ps1` |
| Gate manifests | `sprint_db_expectations.json`, `sprint_board_expectations.json` Sprint 27 |

### CI

Backend CI + Frontend CI + Kustomize CI green on PR #264 merge to `develop`.

---

## 12. Database schema

### Migrations this sprint

| Revision | Summary |
|----------|---------|
| `20260702_0016` | `semantic_transactions.application_id` (FK → `applications`); `ontology_definitions` import fields; interim `semantic_connectors` table (later removed) |
| `20260703_0017` | `technology_adapters.technology_type` → `connector_type`; platform type values; `ontology_definitions.semantic_connector_id` → `connector_id` (FK → `technology_adapters`) |
| `20260704_0018` | Drop `semantic_connectors` |

### Cumulative schema (Sprint 27 end)

**Alembic head:** `20260704_0018`

**Tables (16):** `alembic_version`, `applications`, `application_workspaces`, `semantic_transactions`, `trace_steps`, `discovery_sessions`, `discovery_phase_history`, `blueprints`, `asset_records`, `published_data_products`, `agent_definitions`, `ontology_definitions`, `knowledge_graph_registries`, `technology_adapters`, `agent_runs`, `policy_definitions`

**Cluster (`sip-dev`):** `alembic_version = 20260704_0018`; verified by `verify-sprint-db.ps1 -Sprint 27`.

### Relations (Sprint 27 deltas)

- `semantic_transactions.application_id` → `applications.id` (SET NULL)
- `ontology_definitions.connector_id` → `technology_adapters.id` (SET NULL)
- `technology_adapters.connector_type` — platform category string (replaces vendor-specific `technology_type`)
