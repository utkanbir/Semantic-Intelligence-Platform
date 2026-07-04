# Sprint Retrospective — Sprint 18

**Date:** 2026-07-01  
**Sprint:** Sprint 18 — Console Platform Shell  
**Facilitator:** PMO (DM hat)

**Close gates:** `verify-sprint-close.ps1 -Sprint 18` **PASSED** (cluster DB + project board)

---

## 1. Committed vs delivered

| Issue | Title | Delivered | PR |
|-------|-------|-----------|-----|
| #205 | S18-01 Platform shell and Framework vs Applications IA | Done | #208 |
| #206 | S18-02 Platform read-only stubs | Done | #209 |
| #207 | S18-03 Application workspace nesting | Done | #210 |
| #204 | E-20 Epic | Done | All children delivered |

**Delivery rate:** 3/3 implementation issues; epic E-20 complete.

---

## 2. What went well

- **PO theme A delivered** — Platform (Framework) vs Applications two-tier Console navigation per D-036/D-037.
- **Definition of Done** enforced on all Sprint 18 issues; templates updated for future sprints.
- **68 frontend vitest** (+18 from Sprint 17 close); **188 backend pytest** unchanged.

---

## 3. What did not go well

- Sprint 18 planning and first PR landed same session as milestone creation (acceptable for post-MVP velocity).
- Cluster console image still requires manual `sip-console:s19` rebuild after close pin.

---

## 4. Post-MVP adjustments

- Agent runs UI under Application workspace (journey completion).
- TD-007 auth stub / persona gating for Platform Administrator vs Application Builder.
- Application-scoped audit trace filtering.

---

## 9. Sprint 18 success criteria

| Criterion | Status |
|-----------|--------|
| Platform shell distinguishes Framework vs Applications | **Met** |
| Platform stub screens wired to live APIs (read-only) | **Met** |
| Application workspace breadcrumb/back nav | **Met** |
| Frontend CI green | **Met** |
| Sprint-close gates | **Met** |

---

## 10. End-user release notes

**Platform Console artık Platform (Framework) ve Applications olmak üzere iki katmanlı gezinmeye sahip.**

- **Platform** — Overview, Adapters, Governance ve Audit Trace listeleri (salt okunur)
- **Applications** — Mevcut uygulama listesi `/applications` altında; detay sayfasında breadcrumb ve geri link
- Discovery / Blueprint / Products / Agents sekmeleri çalışmaya devam eder
- Erişim: **http://console.sip.local** (cluster `sip-console:s19` deploy sonrası)

---

## 11. Technical deliverables

### Frontend

| Item | PR |
|------|-----|
| `PlatformShell`, platform routes, placeholder → list pages | #208, #209 |
| `adapters.ts`, `governance.ts`, `auditTrace.ts` API clients | #209 |
| `AdaptersPage`, `GovernancePage`, `AuditTracePage` | #209 |
| Application breadcrumb + back navigation | #210 |

### REST endpoints (consumed, not new)

| Module | Path |
|--------|------|
| adapters | `GET /api/v1/adapters` |
| governance | `GET /api/v1/policies` |
| audit_trace | `GET /api/v1/audit-traces` |

### Infrastructure

| Item | Commit / PR |
|------|-------------|
| `sip-console:s19` dev overlay pin | post-close sprint commit |
| Issue DoD templates + Sprint 18 gate manifests | `ca6ac7c` |

### CI

Frontend CI + Backend CI green on `develop`.

---

## 12. Database schema

**Yok** this sprint.

**Alembic head:** `20260629_0015` — unchanged. Cluster verified by `verify-sprint-db.ps1 -Sprint 18`.

**Cumulative tables (16):** `alembic_version`, `applications`, `application_workspaces`, `semantic_transactions`, `trace_steps`, `discovery_sessions`, `discovery_phase_history`, `blueprints`, `asset_records`, `published_data_products`, `agent_definitions`, `ontology_definitions`, `knowledge_graph_registries`, `technology_adapters`, `agent_runs`, `policy_definitions`.
