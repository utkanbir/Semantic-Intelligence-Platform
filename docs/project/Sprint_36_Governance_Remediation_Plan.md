# Sprint 36 — Governance Remediation

**Role:** Delivery Manager (PMO)
**Date:** 2026-07-09
**Status:** Active  
**Epic:** E-36 (#336)  
**Milestone:** Sprint 36 — Governance Remediation (#38)

---

## 1. Context

An external architecture/process audit of Sprints 0–35 (`SIP_Sprint_Drift_Audit.md`, 2026-07-08) found the codebase itself largely on-contract, but identified a recurring governance gap: sprint-close gates are self-reported and not enforced in CI, several "deferred to next sprint" commitments were dropped without a trace (auth ADR, TraceStep orchestration ADR, real connector provisioning, TD-018), Sprint 33 vanished with no retro/health report, and at least one sprint-close health report (Sprint 31) was rated Green at close and only downgraded to Amber retroactively. No `main` branch or release tag exists despite the Sprint 12 checklist requiring one.

This sprint does not add product features. It closes the governance loop so future sprints' self-reported status is trustworthy and so open technical debt has an expiry instead of silently disappearing.

### Carryover from audit (not a normal sprint retro — see audit report for full evidence trail)

| Item | Source | Disposition |
|------|--------|-------------|
| Sprint-close gates not wired into CI | Audit §CI Gate Reality Check | S36-01 |
| Auth ADR (promised Sprint 2, never written) | Audit Deep Dive 1 | S36-02 |
| TraceStep orchestration ADR (never written) | Audit Deep Dive 1 | S36-02 |
| Real connector provisioning (still Sprint-28 stub) | Audit Scope Creep / Contract Gaps | S36-02 |
| TD-018 — persisted `trace_audience` classification | Audit: Semantic Transaction Incident, residual 1 | S36-02 |
| Health reports rate Green under active drift (Sprint 31) | Audit: Semantic Transaction Incident, residual 2 | S36-03 |
| No `main` branch / no release tag | Audit Deep Dive re: Sprint 0, 12 | S36-04 |
| `POST /ontologies/generate` shipped with no contract entry | Audit Scope Creep | S36-05 |
| Sprint 32 retro §10 contradicts taxonomy contract + code | Audit residual 3 | S36-06 |
| Retro delivery rates re-scoped at close (100% every sprint) | Audit Sprint-by-Sprint Table | S36-07 |

---

## 2. Goal

Make sprint-close status self-correcting instead of self-congratulatory: enforce the existing verification scripts in CI, give every deferred commitment an expiry date and an issue, and stop rating sprints Green when a documented gate trigger was missed.

---

## 3. Committed scope

| ID | Title | Surface | Gate | Depends | Issue |
|----|-------|---------|------|---------|-------|
| S36-01 | Wire `verify_sprint_board.py` / `verify_sprint_db.py` / `verify-sprint-close.ps1` into a required CI check on `end_of_sprint_*` commits; fail if the commit is missing a matching retro or health-report file | DevOps | No | — | #334 ✅ |
| S36-02 | Deferred-items ledger: every "deferred to Sprint N+1" line in a retro/health report must have a GitHub issue with a target milestone; sprint-close lint fails if a deferral has no linked issue. Seed the ledger now with: auth ADR, TraceStep orchestration ADR, real connector provisioning, TD-018 | PMO / process | No | S36-01 | #337 ✅ |
| S36-03 | Health-report template change: require explicit pass/fail against architecture-gate trigger #11-class checks (e.g. "new UI label vs taxonomy contract") before a sprint can be rated Green | PMO / process | No | — | #338 ✅ |
| S36-04 | Cut the release: create `main`, complete the Sprint 12 checklist items still Partial/Pending, tag `v1.0-mvp` | DevOps | Yes* | S36-01 | #339 |
| S36-05 | Contract-sync check: script diffs live FastAPI `/api/v1` routes against `docs/architecture/*_Contract_*.md`; required CI check on backend PRs | Backend / DevOps | Yes* | S36-01 | #340 |
| S36-06 | Correct the record: fix Sprint 32 retro §10 (product/agent records are not on the semantic surface — align with taxonomy contract and code), fix Ontology contract §5.1.1's stale "Sprint 33" reference, remove phantom `"33"` entry from `sprint_deploy_expectations.json`, and either wire a real LLM provider into `llm_resolver.py` or rename "LLM semantic review" until one exists | Docs / Backend | No | — | #341 |
| S36-07 | Retro template change: delivery rate reported against the issue list frozen in the sprint **plan** at kickoff, not against scope as re-negotiated at close | PMO / process | No | — | #342 |

\* S36-04, S36-05: escalate to architecture gate if new CI infra or cross-module tooling is required.

---

## 4. Sequencing

1. **S36-01** (DevOps) — must land first; every later item's "Definition of Done" depends on a real CI gate existing
2. **S36-02 + S36-03 + S36-07** (PMO/process, parallel) — process/template changes, no code dependency on each other
3. **S36-06** (Docs/Backend, parallel) — independent corrections, can run alongside process items
4. **S36-05** (Backend → DevOps) — needs S36-01's CI hook to attach to
5. **S36-04** (DevOps, last) — release should be cut only once the gates that were supposed to guard it are actually enforced

---

## 5. Definition of done

- [x] CI fails a PR that closes a sprint without a matching retro **and** health-report file (S36-01)
- [x] Every open deferral (auth ADR, TraceStep ADR, real provisioning, TD-018) has a linked GitHub issue with a milestone (S36-02)
- [x] Health-report template includes a gate-trigger-11 checklist section; Sprint 31's incident could not recur silently (S36-03)
- [ ] `main` exists, Sprint 12 checklist is 100% complete, `v1.0-mvp` tag exists (S36-04)
- [ ] Contract-sync script runs in CI and fails on an undocumented route (verify against `ontologies/generate` as the known gap) (S36-05)
- [ ] Sprint 32 retro, ontology contract, and `sprint_deploy_expectations.json` corrected; `llm_resolver.py` either has a real provider or the feature is renamed (S36-06)
- [ ] Sprint 37 retro reports delivery rate against the Sprint 37 **plan** doc's original issue list (S36-07)
- [ ] `verify-sprint-close.ps1 -Sprint 36` exit 0
- [ ] Retro with §10–§12 per playbook, referencing this remediation plan and the original audit report
