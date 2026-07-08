# Sprint 35 — Ontology Flow Polish & Generate Extensions

**Role:** Delivery Manager (PMO)  
**Date:** 2026-07-08  
**Status:** Active  
**Epic:** E-35 (#TBD)  
**Milestone:** Sprint 35 — Ontology Flow Polish & Generate Extensions

---

## 1. Context

Sprint 34 delivered the unified 3-mode ontology wizard (Manual, Import, Generate) with draft-first lifecycle, LLM advisory review API, and Approve & Materialize. Sprint 33 was superseded and closed as duplicate.

### Carryover from Sprint 34 retro

| Item | Source | Disposition |
|------|--------|-------------|
| PR `Closes #NNN` template | TD-020 | S35-01 |
| LLM suggestion accept/ignore UI | S34-03 API shipped; UI deferred | S35-02 |
| Generate URL + CSV/Excel sources | S34-07 stretch | S35-03 |
| Relax connector gate for Generate draft | UX note from S34-07 | S35-04 |

---

## 2. Goal

Polish the ontology creation experience: process hygiene (auto-close PRs), full LLM advisory UX, extended Generate sources, and draft-only connector flexibility.

---

## 3. Committed scope

| ID | Title | Surface | Gate | Depends |
|----|-------|---------|------|---------|
| S35-01 | PR template — `Closes #NNN` for auto issue close + board sync | DevOps | No | — |
| S35-02 | LLM semantic review — accept/ignore UI per finding | frontend | No | S34-03 (done) |
| S35-03 | Generate from Sources — URL + CSV/Excel ingestion | cross-cutting | Yes* | S34-07 (done) |
| S35-04 | Generate mode — relax connector requirement until materialize | frontend | No | S34-07 (done) |

\* S35-03: escalate if new cross-module ingestion ports required.

---

## 4. Sequencing

1. **S35-01** (DevOps, parallel) — unblocks TD-020 for remainder of sprint
2. **S35-02** (Frontend) — highest user-visible polish on existing API
3. **S35-04** (Frontend) — quick UX fix, independent
4. **S35-03** (Backend → Frontend) — architecture gate triage first

---

## 5. Definition of done

- [ ] All S35 issues **Done** on project board
- [ ] `verify-sprint-close.ps1 -Sprint 35` exit 0
- [ ] LLM accept/ignore demonstrable in Console validation step
- [ ] Retro with §10–§12 per playbook
