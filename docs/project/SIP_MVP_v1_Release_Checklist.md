# SIP MVP v1.0 Release Readiness Checklist

**Status:** Authoritative supplement (Sprint 12)  
**Date:** 2026-06-29  
**Issue:** S12-05 (#174)  
**Companion:** [SIP_DEVELOPMENT_PLAYBOOK.md](./SIP_DEVELOPMENT_PLAYBOOK.md) §19

Use this checklist before tagging **`main`** for stakeholder MVP demo (`MVP v1.0 — Console & Release`).

---

## 1. Demo and quality

| # | Gate | Status (2026-06-29) | Evidence |
|---|------|---------------------|----------|
| 1 | MVP demo flow passes QA end-to-end | **Met** | `backend/tests/e2e/` — 9-step Assessment flow (188 pytest) |
| 2 | CI green on target release branch | **Partial** | `develop` green (Backend, Frontend, Kustomize CI); `main` tag not yet cut |
| 3 | No open S1/S2 defects for milestone scope | **Met** | No open S1/S2 on Sprint 0–12 scope |
| 4 | OpenAPI reflects shipped API | **Met** | FastAPI `/docs` on `/api/v1` modules |
| 5 | Release notes + known limitations documented | **Partial** | Sprint retros §10; formal v1.0 release notes pending PO sign-off |

---

## 2. Platform surfaces

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 6 | Backend deployable on K8s (`sip-dev`) | **Met** | `sip-backend` Running; Alembic `20260629_0015` |
| 7 | Console deployable on K8s | **Met** | `sip-console:s12`; `console.sip.local` ingress documented |
| 8 | Console: Applications list + detail shell | **Met** | Sprint 11 PRs #164–#168 |
| 9 | Console: at least one module screen live | **Met** | Discovery sessions list (Sprint 12 #172) |
| 10 | Auth / IAM | **Deferred** | TD-007 auth stub ADR — acceptable per MVP scope |

---

## 3. Architecture and governance

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 11 | Module boundaries intact (Ports & Adapters) | **Met** | Sprint health reports S0–S12 |
| 12 | ARR-001–ARR-004 respected | **Met** | E2E tests + architecture reviews |
| 13 | Sprint-close DB + board gates | **Met** | `verify-sprint-close.ps1` per sprint |
| 14 | Lead Architect sign-off | **Pending** | Required before `main` tag |

---

## 4. Release execution (when PO approves)

```powershell
# 1. Merge develop → main via PR (after checklist all Met)
# 2. Tag on main
git tag -a v1.0.0-mvp -m "SIP MVP v1.0 — Console & Release"
git push origin v1.0.0-mvp

# 3. Verify cluster
powershell -File scripts/verify-sprint-close.ps1 -Sprint 12
kubectl -n sip-dev get pods
```

---

## 5. Known MVP limitations (do not block v1.0)

Per playbook §19 and `SIP_MVP_Scope_v0_1`:

- Multi-tenant SaaS, HA, multi-region
- Enterprise IAM (auth stub only)
- Physical adapter integrations (stub ports)
- Full Platform Console module screens (Blueprint, Products, Agents placeholders)
- MCP external APIs
- TraceStep orchestration ADR (TD-006)

---

## 6. Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Product Owner | | | ☐ |
| Lead Architect | | | ☐ |
| Tech Lead | | | ☐ |

**Next action:** PO reviews §1–§3; when all **Met**, schedule `develop` → `main` merge and `v1.0.0-mvp` tag.
