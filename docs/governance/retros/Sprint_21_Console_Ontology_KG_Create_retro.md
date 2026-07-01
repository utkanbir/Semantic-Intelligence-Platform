# Sprint Retrospective — Sprint 21

**Date:** 2026-07-01  
**Sprint:** Sprint 21 — Console Ontology & KG Create  
**Facilitator:** PMO (DM hat)

**Close gates:** `verify-sprint-close.ps1 -Sprint 21` **PASSED**

---

## 1. Committed vs delivered

| Issue | Title | Delivered | PR |
|-------|-------|-----------|-----|
| #227 | S21-01 Create ontology definition in Console | Done | #230 |
| #228 | S21-02 Create knowledge graph registry in Console | Done | #231 |
| #229 | S21-03 Ontology and KG lifecycle status actions | Done | #232 |
| #226 | E-23 Epic | Done | All children delivered |

**Delivery rate:** 3/3 implementation issues; epic E-23 complete.

---

## 2. What went well

- Sprint 20 read-only foundation extended with create + lifecycle — full ontology/KG Console CRUD subset without backend changes.
- **137 frontend vitest** (+23 from Sprint 20 close); **188 backend pytest** unchanged.

---

## 3. What did not go well

- None blocking; single-session delivery continues post-MVP velocity pattern.

---

## 4. Post-MVP adjustments

- TD-007 auth stub / persona gating.
- Ontology editor / graph visualization.
- Version fork UI for ontology/KG.

---

## 9. Sprint 21 success criteria

| Criterion | Status |
|-----------|--------|
| Create ontology from Console | **Met** |
| Create KG registry with optional bound ontologies | **Met** |
| Lifecycle status actions for ontology + KG | **Met** |
| Frontend CI green | **Met** |
| Sprint-close gates | **Met** |

---

## 10. End-user release notes

**Application workspace artık ontology ve knowledge graph oluşturma ve lifecycle aksiyonlarını destekliyor.**

- **Ontology** — Yeni definition oluşturma; Validate → Approve → Publish → Version → Retire
- **Knowledge graph** — Yeni registry oluşturma; isteğe bağlı ontology bağlama; Populate / Update / Archive
- Erişim: **http://console.sip.local** (cluster `sip-console:s22` deploy sonrası)

---

## 11. Technical deliverables

### Frontend

| Item | PR |
|------|-----|
| Ontology create form + `createOntology` | #230 |
| KG create form + bound ontology bindings | #231 |
| Lifecycle PATCH status actions both pages | #232 |

### REST endpoints (consumed)

| Module | Path |
|--------|------|
| ontology | POST/PATCH `/api/v1/ontologies`, PATCH `.../status` |
| knowledge_graph | POST/PATCH `/api/v1/knowledge-graphs`, PATCH `.../status` |

### Infrastructure

| Item | Commit |
|------|--------|
| `sip-console:s22` dev overlay pin | post-close sprint commit |

---

## 12. Database schema

**Yok** this sprint.

**Alembic head:** `20260629_0015` — unchanged.

**Cumulative tables (16):** `alembic_version`, `applications`, `application_workspaces`, `semantic_transactions`, `trace_steps`, `discovery_sessions`, `discovery_phase_history`, `blueprints`, `asset_records`, `published_data_products`, `agent_definitions`, `ontology_definitions`, `knowledge_graph_registries`, `technology_adapters`, `agent_runs`, `policy_definitions`.
