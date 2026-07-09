# SIP Deferred Items Ledger

**Version:** 1.0 (Sprint 36 — S36-02)  
**Status:** Authoritative process supplement  
**Machine-readable source:** [`scripts/deferred_items_ledger.json`](../../scripts/deferred_items_ledger.json)

---

## Purpose

Prevent "deferred to next sprint" commitments from disappearing without trace. Every open deferral must map to a GitHub issue with a target milestone.

---

## Rules

1. **Ledger** — Open audit/retro deferrals are listed in `deferred_items_ledger.json` with `github_issue` and `target_milestone`.
2. **Sprint close** — `verify_sprint_deferrals.py` runs as part of `verify_sprint_close_ci.py` when closing a sprint:
   - Validates ledger structure and (when `GH_TOKEN` set) linked issue milestones.
   - Scans the sprint retro + health report for deferral language; each line must reference `#NNN` or a ledger id (e.g. `TD-018`).
3. **New deferrals** — When adding deferral language to a retro/health report, either link `#issue` inline or add/update a ledger entry first.

---

## Seeded items (S36-02)

| ID | Issue | Title |
|----|-------|-------|
| TD-007 | #343 | MVP authentication stub ADR |
| TD-006-ADR | #344 | TraceStep orchestration ADR |
| connector-provisioning-real | #345 | Real in-cluster connector provisioning |
| TD-018 | #346 | Persist trace_audience on write |

**Target milestone:** Technical Debt Backlog (#39)

---

## Commands

```powershell
python scripts/verify_sprint_deferrals.py --sprint 36
```

Part of full close gate:

```powershell
powershell -File scripts/verify-sprint-close.ps1 -Sprint 36
```
