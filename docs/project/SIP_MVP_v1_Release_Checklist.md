# SIP MVP v1.0 Release Readiness Checklist

**Status:** Authoritative supplement (Sprint 12, completed Sprint 36 — S36-04)  
**Date:** 2026-07-09 (updated from 2026-06-29)  
**Issue:** S12-05 (#174), S36-04 (#339)  
**Companion:** [SIP_DEVELOPMENT_PLAYBOOK.md](./SIP_DEVELOPMENT_PLAYBOOK.md) §19

Use this checklist before tagging **`main`** for stakeholder MVP demo (`MVP v1.0 — Console & Release`).

---

## 1. Demo and quality

| # | Gate | Status (2026-07-09) | Evidence |
|---|------|---------------------|----------|
| 1 | MVP demo flow passes QA end-to-end | **Met** | `backend/tests/e2e/` — 9-step Assessment flow (pytest) |
| 2 | CI green on target release branch | **Met** | `develop` green through Sprint 36 (Backend, Frontend, Kustomize, Sprint Governance CI); `main` synced at S36-04 |
| 3 | No open S1/S2 defects for milestone scope | **Met** | No open S1/S2 on Sprint 0–12 MVP scope |
| 4 | OpenAPI reflects shipped API | **Met** | FastAPI `/docs` on `/api/v1` modules; contract-sync CI (S36-05) |
| 5 | Release notes + known limitations documented | **Met** | §7 below + sprint retros §10 (Sprints 11–35) |

---

## 2. Platform surfaces

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 6 | Backend deployable on K8s (`sip-dev`) | **Met** | `sip-backend` Running; Alembic at repo head |
| 7 | Console deployable on K8s | **Met** | `sip-console` on `sip-dev`; `console.sip.local` ingress |
| 8 | Console: Applications list + detail shell | **Met** | Sprint 11 |
| 9 | Console: at least one module screen live | **Met** | Discovery + ontology wizard flows (Sprints 12–35) |
| 10 | Auth / IAM | **Deferred** | TD-007 auth stub ADR — acceptable per MVP scope |

---

## 3. Architecture and governance

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 11 | Module boundaries intact (Ports & Adapters) | **Met** | Sprint health reports S0–S35 |
| 12 | ARR-001–ARR-004 respected | **Met** | E2E tests + architecture reviews |
| 13 | Sprint-close DB + board gates | **Met** | `verify-sprint-close.ps1` + Sprint Governance CI (S36-01) |
| 14 | Lead Architect sign-off | **Met** | Solo-maintainer policy (playbook §6); S36 governance remediation complete; no open architecture violations on release SHA |

---

## 4. Release execution (S36-04 — completed)

```powershell
# 1. Merge develop → main via PR (S36-04)
# 2. Tag on main
git tag -a v1.0-mvp -m "SIP MVP v1.0 — develop through Sprint 36 governance remediation"
git push origin v1.0-mvp

# 3. Verify cluster (latest sprint close on develop)
powershell -File scripts/verify-sprint-close.ps1 -Sprint 35
```

**Note:** Legacy tag `v1.0.0-mvp` (2026-06-29, Sprint 12 partial) superseded by `v1.0-mvp` on current `main`.

---

## 5. Known MVP limitations (do not block v1.0)

Per playbook §19 and `SIP_MVP_Scope_v0_1`:

- Multi-tenant SaaS, HA, multi-region
- Enterprise IAM (auth stub only — TD-007)
- Physical adapter integrations (stub ports)
- Full Platform Console module screens (some placeholders remain)
- MCP external APIs
- TraceStep orchestration ADR (TD-006)

---

## 6. Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Product Owner | Solo maintainer | 2026-07-09 | ☑ (S36-04 release cut) |
| Lead Architect | Solo-maintainer waiver | 2026-07-09 | ☑ (playbook §6) |
| Tech Lead | Solo maintainer | 2026-07-09 | ☑ |

---

## 7. MVP v1.0 release notes (stakeholder summary)

**Platform Console** is deployable on local Kubernetes (`sip-dev`) with Applications, Discovery, Blueprints, Assets, Products, Agents, Ontology creation wizard (manual / import / generate), Semantic Transactions vs Audit Trace split, and platform adapters.

**Backend API** at `/api/v1` covers applications, discovery, blueprints, assets, products, agents, ontologies, knowledge graphs, audit trace, semantic transactions, and governance policies.

**Not in this release:** production IAM, real LLM provider (advisory semantic review uses stub port), real connector provisioning (S28 stub), enterprise HA.

**Governance (Sprint 36):** sprint-close CI gates, deferred-items ledger, contract-sync on backend PRs, health-report gate-trigger-11 checklist.

**Next action:** Use `main` + tag `v1.0-mvp` for stakeholder demos; continue feature work on `develop`.
