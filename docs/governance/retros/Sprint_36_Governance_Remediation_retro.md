# Sprint Retrospective — Sprint 36

**Date:** 2026-07-09  
**Sprint:** Sprint 36 — Governance Remediation  
**Kickoff plan:** `docs/project/Sprint_36_Governance_Remediation_Plan.md` *(frozen at sprint start — delivery rate denominator)*  
**Facilitator:** PMO (DM hat)

**Close gates:** `verify-sprint-close.ps1 -Sprint 36` **PASSED** (cluster DB + sip-dev deploy + project board + sprint governance CI)

**Audit reference:** `SIP_Sprint_Drift_Audit.md` (2026-07-08)

---

## 1. Committed vs delivered

Report against the **kickoff plan** committed scope (§3), not issues added or dropped at close.

| Issue | Title | Committed (kickoff plan) | Delivered | PR |
|-------|-------|-------------------------|-----------|-----|
| #334 | S36-01 Sprint-close governance CI | Yes | Done | #335 |
| #337 | S36-02 Deferred-items ledger | Yes | Done | #347 |
| #338 | S36-03 Health-report gate-trigger-11 checklist | Yes | Done | #348 |
| #339 | S36-04 Release cut (`main` + `v1.0-mvp`) | Yes | Done | #353, #354 |
| #340 | S36-05 Contract-sync CI | Yes | Done | #351 |
| #341 | S36-06 Record corrections + advisory review rename | Yes | Done | #350 |
| #342 | S36-07 Retro delivery rate vs kickoff plan | Yes | Done | #349 |
| #336 | E-36 Epic | Yes | Done | All children delivered |

**Delivery rate:** 7/7 implementation issues; epic E-36 complete.

**Scope drift:** None. Issue #339 closed manually after PR #354 merged to `main` (default branch `develop` did not auto-close).

---

## 2. What went well

- **Audit remediation closed end-to-end** — all ten audit carryover items mapped to S36-01…S36-07 and delivered.
- **CI gates are real** — Sprint Governance CI, contract-sync on Backend CI, deferral/health/retro scripts wired into `verify-sprint-close.ps1`.
- **Deferrals tracked in ledger** — GitHub issues #343–#346 on Technical Debt Backlog milestone. > Correction (2026-07-09, #361): `expires_sprint` field and expiry gate land in Sprint 37 (S37-06); Sprint 36 shipped tracking only.
- **MVP release cut** — `main` synced with `develop`; `v1.0-mvp` tag; Sprint 12 checklist completed.
- **No product regression** — zero schema migration; `sip-dev` deploy unchanged from Sprint 35 images.

---

## 3. What did not go well

- **Release PR base branch** — `develop` → `main` PR #354 did not auto-close #339; required manual close + board reconcile.
- **CI queue latency** — GitHub Actions runner queue caused 15m cancelled runs on PR #351; Ruff E501 caught on retry.
- **Sprint 33 historical gap** — not repaired retroactively; audit noted missing retro/health (documented in remediation plan context).

---

## 4. Sprint 37 adjustments

- Use kickoff plan + **Kickoff plan:** link in retro from day one (S36-07 enforcement from Sprint 37).
- Burn down Technical Debt Backlog issues #343–#346 per PO priority.
- Shrink `contract_sync_baseline.json` as contracts absorb grandfathered routes.

---

## 9. Sprint 36 success criteria

| Criterion | Status |
|-----------|--------|
| Sprint-close gates enforced in CI (S36-01) | **Met** |
| Deferred items ledger + lint (S36-02) | **Met** |
| Health-report gate-trigger-11 template (S36-03) | **Met** |
| `main` + `v1.0-mvp` tag (S36-04) | **Met** |
| Contract-sync CI (S36-05) | **Met** |
| Record corrections (S36-06) | **Met** |
| Retro delivery-rate template (S36-07) | **Met** |
| Sprint-close gates | **Met** |

---

## 10. End-user release notes

Bu sprintte son kullanıcı için görünür bir değişiklik yok.

*(Internal only: Console copy "LLM semantic review" → "Advisory semantic review" — stub port unchanged.)*

---

## 11. Technical deliverables

### REST endpoints

**Yok**

### Data models

**Yok**

### Scripts / CI (governance)

| Path | Purpose |
|------|---------|
| `scripts/verify_sprint_close_ci.py` | Sprint-close doc + manifest + deferral/health/retro gates |
| `scripts/verify_sprint_deferrals.py` | Deferral ledger + retro/health scan |
| `scripts/verify_health_report_gate11.py` | Gate-trigger-11 checklist (Sprint ≥ 36) |
| `scripts/verify_sprint_retro_delivery.py` | Delivery rate vs kickoff plan (Sprint ≥ 37) |
| `scripts/verify_contract_sync.py` | OpenAPI vs architecture contracts |
| `scripts/deferred_items_ledger.json` | Seeded deferrals #343–#346 |
| `scripts/contract_sync_baseline.json` | Grandfathered route baseline |
| `.github/workflows/sprint-governance-ci.yml` | Required CI on `develop` |

### Reports

| Path | Purpose |
|------|---------|
| `docs/governance/SIP_Deferred_Items_Ledger.md` | Deferral process supplement |
| `docs/project/SIP_MVP_v1_Release_Checklist.md` | MVP v1.0 checklist completed (S36-04) |

### Infrastructure

| Item | Detail |
|------|--------|
| `main` branch | Synced with `develop` through Sprint 36 (PR #354) |
| Tag `v1.0-mvp` | Annotated tag on `main` release SHA |
| `sip-dev` | `sip-backend:s53` / `sip-console:s54` (unchanged) |

---

## 12. Database schema

**Yok** — no Alembic revision this sprint.

**Alembic head (cluster):** `20260706_0019` — verified by `verify-sprint-db.ps1 -Sprint 36`.

**Cumulative tables (16):** alembic_version, applications, application_workspaces, semantic_transactions, discovery_sessions, discovery_phase_history, blueprints, asset_records, trace_steps, published_data_products, agent_definitions, ontology_definitions, knowledge_graph_registries, technology_adapters, agent_runs, policy_definitions.
