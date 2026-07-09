# Sprint 37 — Governance Hardening

**Role:** Delivery Manager (PMO)
**Date:** 2026-07-09
**Status:** Active
**Epic:** E-37 (#355)  
**Milestone:** Sprint 37 — Governance Hardening (#40)

---

## 1. Context

A second, adversarial audit (`SIP_Sprint36_Second_Audit.md`, 2026-07-09) re-checked the Sprint 36 governance remediation and the current state of the whole repo. Verdict: **codebase Green, governance remediation Amber**. Sprint 36 built real machinery — the scripts exist, run, and are wired into CI — but the machinery's trigger is self-reported, its strongest gate was first exercised via the one path it cannot block, its newest gate fails against its own sprint, and its headline "expiry" promise shipped without any expiry. Round 1's core pathology (self-congratulatory close reporting) survived remediation intact.

This sprint does not add product features. It closes the gaps the second audit found in the governance machinery itself, and fixes one undisclosed product-level drift item (the LLM stub) that surfaced during the re-check.

### Carryover from second audit (see audit report for full evidence trail)

| Item | Source | Severity | Disposition |
|------|--------|----------|-------------|
| Sprint-close CI gate only triggers on `end_of_sprint_*` commit subject, only on `develop`; Sprint 36's own close was a direct push (not a PR) so the gate could not block it; Sprint 29/33 have no such commit at all | F-1 | High | S37-01 |
| Delivery-rate gate (S36-07) parses issue/PR numbers wrong, counts "Not done" as delivered, fails when run against Sprint 36 itself, and was scoped to start one sprint late | F-2 | High | S37-02 |
| "Generate from Sources" silently returns a hardcoded LLM stub for any provider value; undisclosed in Sprint 34/35 retros and health reports (both rated Green) | F-3 | High | S37-03 |
| Taxonomy contract §6.1 omits 4 of 11 code-emitted `semantic_lineage` types; self-certified Pass in the S36 gate-11 checklist anyway | F-4 | Medium-High | S37-04 |
| Contract-sync baseline grandfathers 21/86 routes (24%) with no freeze test, owner, or deadline | F-5 | Medium | S37-05 |
| Deferred-items ledger has no expiry field despite the plan/retro claiming "deferrals have expiry"; TD-019/TD-021 missing from ledger; scanner has synonym/keyword escapes | F-6 | Medium | S37-06 |
| Gate-trigger-11 checklist verifies the table is filled in, not that the Pass rows are true | F-7 | Medium | S37-07 |
| Sprint 29 and 30 have no health reports (new finding); Sprint 33 still has no retro/health and was never formally waived | F-8 | Medium | S37-08 |
| Sprint 32 retro was silently edited in place (no correction marker); `develop` history was `git filter-branch`-rewritten in June to manufacture the `end_of_sprint_N` convention the new gate depends on | F-9 | Medium | S37-08 |
| `handoff.md` not updated at the Sprint 36 close despite its own header rule; Sprint 36 retro doesn't follow the retro template's section numbering; health report is self-certified by the same agent that wrote the code | F-10 | Low-Medium | S37-09 |
| `main` has zero CI (all 4 workflows trigger only on `develop`); playbook §6 required-checks list was never updated to include Sprint Governance CI | F-11 | Low | S37-09 |
| Duplicate §8.5 numbering in ontology contract; two non-overlapping technical-debt registers (handoff.md vs ledger) | F-12 | Low | S37-09 |

---

## 2. Goal

Close the gap between what the governance machinery claims to enforce and what it actually can enforce: make the sprint-close gate un-bypassable via direct push, make the delivery-rate gate pass a real test against real data before it gates anyone else, give deferred debt an actual expiry, and stop a stub feature from being presented as a working capability.

---

## 3. Committed scope

| ID | Title | Surface | Gate | Depends | Issue |
|----|-------|---------|------|---------|-------|
| S37-01 | Protect `develop` and `main` against direct pushes; require sprint-close commits to land via PR so Sprint Governance CI can actually block; add a scheduled or milestone-webhook check that reconciles a closed GitHub milestone against the presence of a matching `end_of_sprint_*` commit + retro + health file | DevOps | Yes* | — | #356 |
| S37-02 | Fix `verify_sprint_retro_delivery.py`: exact-match plan-committed issues (not every `#\d+` in a row), exact-match "Done" status (not substring `"done"`), stop treating an honestly non-delivered issue as a hard error. Add a fixture test that runs the gate against the real Sprint 36 plan + retro. Un-check the premature Sprint 37 DoD box in the Sprint 36 plan until this sprint actually closes | PMO / process | No | S37-01 | #357 |
| S37-03 | `llm_resolver.resolve_llm_port()` fails fast (raises) on an unrecognized `llm_provider` instead of silently returning the stub; label Generate-from-Sources output as sample/stub in the UI until a real provider is wired in; add a correction annotation to the Sprint 34 and Sprint 35 health reports noting the undisclosed stub; add a ledger entry (with target sprint) for a real LLM provider | Backend / Frontend | Yes* | — | #358 |
| S37-04 | Amend taxonomy contract §6.1 to include the 4 undeclared `semantic_lineage` types (`ontology.generated`, `ontology.suggestion_reviewed`, `ontology.connector_selected`, `ontology.materialized`); extend contract-sync tooling (or a sibling script) to diff `SEMANTIC_LINEAGE_TRANSACTION_TYPES` against the contract table in CI | Backend / Docs | No | — | #359 |
| S37-05 | Add a test that freezes `contract_sync_baseline.json` at its current 21 entries (any growth fails CI); open one tracked issue per undocumented route surface (connectors alias, applications CRUD/status, audit-traces, semantic-transactions, adapters test/provision, health) with a target milestone | Backend / DevOps | No | S37-04 | #360 |
| S37-06 | Add an `expires_sprint` (or date) field to the deferred-items ledger schema and fail the close gate when an open item is past its expiry; seed TD-019 (multi-row semantic transactions) and TD-021 (.xls unsupported) from `handoff.md` §8 into the ledger; correct the Sprint 36 retro's "Deferrals have expiry" claim; tighten the deferral scanner (exact-phrase match, remove the self-referential `EXCLUDE_LINE` escape) | PMO / process | No | S37-01 | #361 |
| S37-07 | Require an evidence link (file path, PR, or test name) on every Pass row in the gate-trigger-11 checklist; reviewer spot-checks at least one evidence link per health report before accepting Green | PMO / process | No | — | #362 |
| S37-08 | Backfill minimal, clearly-labeled "reconstructed, post-hoc" health notes for Sprint 29 and Sprint 30, or record an explicit written waiver; formally decide and document Sprint 33's disposition (waived vs. backfilled); add a rule requiring an inline `> Correction (date, issue #N)` annotation on any edit to a closed sprint's retro/health file, going forward | Docs / PMO | No | — | #363 |
| S37-09 | Sprint-close hygiene: enforce `handoff.md` update as part of the close gate (fail if the close commit doesn't touch it); align the Sprint 37 retro to the full template section numbering; add `main` to backend/frontend/kustomize CI triggers; update playbook §6 required-checks list to include Sprint Governance CI; fix duplicate §8.5 numbering in the ontology contract; reconcile `handoff.md` §8 and the deferred-items ledger into one debt register | DevOps / Docs | No | S37-01 | #364 |

\* S37-01, S37-03: escalate to architecture gate if branch-protection changes require org-level admin access, or if the LLM fail-fast change affects a code path other sprints depend on.

---

## 4. Sequencing

1. **S37-01** (DevOps) — must land first; it is what makes every other CI gate in this plan (and Sprint 36's) actually enforceable
2. **S37-02 + S37-06 + S37-07** (PMO/process, parallel) — gate-logic and ledger fixes, no code dependency on each other
3. **S37-03** (Backend/Frontend, parallel) — independent product-drift fix, can run alongside process items
4. **S37-04 → S37-05** (Backend/Docs then DevOps) — contract amendment must land before the baseline-freeze test locks in the route set
5. **S37-08** (Docs/PMO, parallel, any time) — historical backfill/waiver, no dependency
6. **S37-09** (DevOps/Docs, last) — close-hygiene enforcement should land once the other gates it depends on (S37-01) are real, so this sprint's own close is the first one actually held to the new standard

---

## 5. Definition of done

- [ ] A direct push of an `end_of_sprint_*` commit to `develop` or `main` is rejected; sprint closes require a PR (S37-01)
- [ ] `verify_sprint_retro_delivery.py` passes its own fixture test against the real Sprint 36 plan + retro, with corrected parsing logic (S37-02)
- [ ] `resolve_llm_port()` raises on an unknown provider; Generate-from-Sources UI clearly labels stub output; S34/S35 health reports carry a correction annotation (S37-03)
- [ ] Taxonomy contract §6.1 lists all 11 code-emitted `semantic_lineage` types; a CI check fails if code and contract diverge again (S37-04)
- [ ] `contract_sync_baseline.json` growth is blocked by a test; each of the 21 grandfathered route groups has a tracked issue with a milestone (S37-05)
- [ ] Ledger items carry an `expires_sprint` field; close gate fails on an expired open item; TD-019/TD-021 are seeded; the Sprint 36 retro's expiry claim is corrected (S37-06)
- [ ] Every gate-trigger-11 Pass row cites evidence; reviewer sign-off confirms at least one spot-check (S37-07)
- [ ] Sprint 29/30 have either a backfilled health note or a written waiver; Sprint 33's disposition is formally recorded (S37-08)
- [ ] `handoff.md` is updated as part of this sprint's own close commit; `main` has CI on PRs; playbook §6 required-checks list is current (S37-09)
- [ ] `verify-sprint-close.ps1 -Sprint 37` exit 0, executed via a PR (not a direct push) — the first sprint close this plan's own S37-01 gate gets to actually test
- [ ] Retro follows the full template section numbering, referencing this plan and `SIP_Sprint36_Second_Audit.md`
