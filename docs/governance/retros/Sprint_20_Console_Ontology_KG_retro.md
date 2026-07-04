# Sprint Retrospective — Sprint 20

**Date:** 2026-07-01  
**Sprint:** Sprint 20 — Console Ontology & KG  
**Facilitator:** PMO (DM hat)

**Close gates:** `verify-sprint-close.ps1 -Sprint 20` **PASSED** (cluster DB + project board)

---

## 1. Committed vs delivered

| Issue | Title | Delivered | PR |
|-------|-------|-----------|-----|
| #220 | S20-01 Ontology definitions list tab and API client | Done | #223 |
| #221 | S20-02 Knowledge graph registries list tab and API client | Done | #224 |
| #222 | S20-03 Agent run detail drill-down | Done | #225 |
| #219 | E-22 Epic | Done | All children delivered |

**Delivery rate:** 3/3 implementation issues; epic E-22 complete.

---

## 2. What went well

- **Deferred ontology/KG Console surfaces delivered** — read-only Application workspace tabs consuming Sprint 7 APIs.
- **S19 carry-over closed** — agent run detail with payload/result visibility.
- **114 frontend vitest** (+24 from Sprint 19 close); **188 backend pytest** unchanged.

---

## 3. What did not go well

- Full sprint delivered same session as kickoff (acceptable post-MVP velocity).

---

## 4. Post-MVP adjustments

- Ontology/KG create and lifecycle in Console (future).
- TD-007 auth stub / persona gating.
- Graph visualization / ontology editor.

---

## 9. Sprint 20 success criteria

| Criterion | Status |
|-----------|--------|
| Application workspace Ontology read-only list | **Met** |
| Application workspace Knowledge graph read-only list | **Met** |
| Agent run detail drill-down | **Met** |
| Frontend CI green | **Met** |
| Sprint-close gates | **Met** |

---

## 10. End-user release notes

**Application workspace artık Ontology ve Knowledge graph listelerine sahip; agent run detayı görüntülenebilir.**

- **Ontology** — Uygulama kapsamlı ontology definition listesi (salt okunur)
- **Knowledge graph** — KG registry listesi (salt okunur)
- **Agent runs** — Run satırından detay sayfası (payload, result, zaman damgaları)
- Erişim: **http://console.sip.local** (cluster `sip-console:s21` deploy sonrası)

---

## 11. Technical deliverables

### Frontend

| Item | PR |
|------|-----|
| `ontologies.ts`, `OntologiesPage` | #223 |
| `knowledgeGraphs.ts`, `KnowledgeGraphsPage` | #224 |
| `AgentRunDetailPage`, nested route | #225 |

### REST endpoints (consumed, not new)

| Module | Path |
|--------|------|
| ontology | `GET /api/v1/ontologies` |
| knowledge_graph | `GET /api/v1/knowledge-graphs` |
| agent_runtime | `GET /api/v1/agent-runs/{id}` |

### Infrastructure

| Item | Commit |
|------|--------|
| `sip-console:s21` dev overlay pin | post-close sprint commit |

### CI

Frontend CI + Backend CI green on `develop`.

---

## 12. Database schema

**Yok** this sprint.

**Alembic head:** `20260629_0015` — unchanged.

**Cumulative tables (16):** `alembic_version`, `applications`, `application_workspaces`, `semantic_transactions`, `trace_steps`, `discovery_sessions`, `discovery_phase_history`, `blueprints`, `asset_records`, `published_data_products`, `agent_definitions`, `ontology_definitions`, `knowledge_graph_registries`, `technology_adapters`, `agent_runs`, `policy_definitions`.
