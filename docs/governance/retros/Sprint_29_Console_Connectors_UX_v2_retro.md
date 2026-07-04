# Sprint Retrospective — Sprint 29

**Date:** 2026-07-03  
**Sprint:** Sprint 29 — Console Connectors UX v2  
**Facilitator:** PMO (DM hat)

**Close gates:** `verify-sprint-close.ps1 -Sprint 29` **PASSED** (cluster DB + project board)

---

## 1. Committed vs delivered

| Issue | Title | Delivered | PR |
|-------|-------|-----------|-----|
| #272 | S29-01 Platform hub page | Done | #277 |
| #274 | S29-02 Connectors list-first UX | Done | #278 |
| #275 | S29-03 Auto-generate connector key | Done | #279 |
| #276 | S29-04 Icon picker + vector_database | Done | #280 |
| #273 | E-29 Epic | Done | All children delivered |

**Delivery rate:** 4/4 implementation issues; epic E-29 complete.

---

## 2. What went well

- **PO feedback fully addressed** — platform hub, list-first connectors, no manual key, icon picker, vector DB type.
- **Fast parallel delivery** — #272 and #274 merged in parallel; #275 then #276 sequenced cleanly.
- **Architecture gate** — #276 auto-APPROVE (catalog extension only; existing VectorStorePort stub).
- **196 frontend tests green** after #276; backend adapters suite green.

---

## 3. What did not go well

- GitHub issues did not auto-close from PR merges (missing `Closes #N` in PR bodies) — closed manually at sprint end.
- `sprint_db_expectations.json` entry for Sprint 29 added at close (no migration sprint — should template earlier).
- Cluster console image not redeployed in this session — PO should rebuild `sip-console` to see UI on console.sip.local.

---

## 4. Sprint 30 adjustments

- Deploy updated console image to sip-dev (s33+).
- Update TD-006 supplement with `vector_database` type.
- Vector DB in-cluster provision stubs (qdrant/pgvector/weaviate) if needed.

---

## 9. Sprint 29 success criteria

| Criterion | Status |
|-----------|--------|
| Platform card → hub, not direct Connectors | **Met** |
| Connectors list-first + New connector below | **Met** |
| Connector key auto-generated (hidden from form) | **Met** |
| Icon picker for type/vendor | **Met** |
| vector_database connector type | **Met** |
| Sprint-close gates | **Met** |

---

## 10. End-user release notes

**Platform Console connector deneyimi yenilendi.**

- Ana sayfada **Platform** kartı artık doğrudan Connectors’a gitmiyor; **Platform hub** açılıyor (Connectors, Governance, Audit Trace).
- **Connectors** sayfasında önce mevcut kayıtlar listeleniyor; **New connector** butonu listenin altında; forma yalnızca tıklayınca geçiliyor.
- Yeni connector oluştururken **Connector key** alanı kaldırıldı — sistem otomatik üretiyor.
- Connector **tipi** ve **vendor** seçimi ikon grid ile yapılıyor (PostgreSQL, MinIO, Qdrant vb.).
- Yeni connector tipi: **Vector database** (Qdrant, pgvector, Weaviate vendor’ları).

Erişim: **http://console.sip.local** (güncel console image deploy sonrası)

---

## 11. Technical deliverables

### REST endpoints

**Yok** — mevcut `/api/v1/connectors` genişletildi (optional `connector_key` on POST; `vector_database` enum value).

### Data models

| Change | Notes |
|--------|-------|
| `ConnectorType.vector_database` | Backend enum + stub ping |
| Auto `connector_key` | `connector_key.py` slug from title + vendor |

### Frontend

| Item | PR |
|------|-----|
| `PlatformHubPage` `/platform` | #277 |
| Connectors list-first layout | #278 |
| Remove key field; optional create payload | #279 |
| `ConnectorTypePicker`, `ConnectorVendorPicker`, icons | #280 |
| Vector DB vendors in catalog | #280 |

### Reports

**Yok**

---

## 12. Database schema

**Yok** this sprint.

**Alembic head:** `20260704_0018` — unchanged. Cluster verified by `verify-sprint-db.ps1 -Sprint 29`.

**Cumulative tables (16):** alembic_version, applications, application_workspaces, semantic_transactions, discovery_sessions, discovery_phase_history, blueprints, asset_records, trace_steps, published_data_products, agent_definitions, ontology_definitions, knowledge_graph_registries, technology_adapters, agent_runs, policy_definitions.

**Relations (unchanged):** technology_adapters standalone; ontology_definitions.connector_id → technology_adapters.id.
