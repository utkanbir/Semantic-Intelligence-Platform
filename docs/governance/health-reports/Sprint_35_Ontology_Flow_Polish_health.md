# Architecture Health Report — Sprint 35

**Date:** 2026-07-08  
**Sprint:** Sprint 35 — Ontology Flow Polish & Generate Extensions  
**Author:** Lead Architect (automated review)  
**Companion:** [SIP_Architecture_Governance_Policy.md](../SIP_Architecture_Governance_Policy.md)

**Close gates:** `verify-sprint-close.ps1 -Sprint 35` **PASSED**

---

## 1. Summary

> Correction (2026-07-09, #358): `resolve_llm_port()` returned the deterministic stub for any `llm_provider` value; Generate-from-Sources output was not disclosed as stub-only at close.

**Green.** Sprint 35 added process hygiene (PR template), Console LLM advisory UX, and bounded URL ingestion via a new `WebContentPort` — all without schema migration or module boundary violations.

---

## 2. Merged PRs reviewed

| PR | Issue | Gate (Y/N) | Architect review | Outcome |
|----|-------|------------|------------------|---------|
| #329 | #325 | No | No | APPROVE |
| #330 | #326 | No | No | APPROVE |
| #331 | #328 | No | No | APPROVE |
| #332 | #327 | Yes | Automated | APPROVE |
| #333 | #327 | No | No | APPROVE |

---

## 3. Technical debt register

| ID | Description | Introduced in | Severity | Remediation |
|----|-------------|---------------|----------|-------------|
| TD-018 | `trace_audience` derived at read time only | Sprint 32 | S3 | Future migration |
| TD-019 | Per-phase semantic transaction rows vs single row | Sprint 34 | S3 | Schema + taxonomy change |
| TD-020 | PR bodies omit Closes #NNN | Sprint 34 | S2 | **Resolved Sprint 35** (#329) |
| TD-021 | `.xls` (legacy Excel) not supported client-side | Sprint 35 / #333 | S3 | Document or add parser in Sprint 36 |

---

## 4. Boundary and dependency review

| Module / area | Concern | Status |
|---------------|---------|--------|
| `shared/ports` | New `WebContentPort` — ontology-only consumer | Resolved (gate APPROVE) |
| Frontend | CSV/XLSX parse client-side; no backend CSV port | Resolved |
| Process | PR template enforces Closes #NNN | Resolved |

---

## 5. ADR status

| ADR | Status | Notes |
|-----|--------|-------|
| ADR-001 | Accepted | Image pin `s53`/`s54` only |

**New ADR needs:** None for `WebContentPort` (bounded fetch, single consumer).

---

## 6. Namespace and infrastructure

| Topic | Finding |
|-------|---------|
| `sip-dev` rollout | Verified at `sip-backend:s53` / `sip-console:s54` |

---

## 7. Domain model alignment

No drift. URL sources resolve to inline text before existing extraction pipeline; no persistence model change.

---

## 8. Gate effectiveness

| Metric | Value |
|--------|-------|
| PRs with gate = Yes | 1 (#332) |
| False positives | 0 |
| Missed gates | 0 |

---

## 9. Risks for next sprint

| Risk | Mitigation |
|------|------------|
| URL fetch SSRF / abuse | Enforce size cap (done); consider allowlist in future |
| Legacy `.xls` user expectation | TD-021 — document or defer |
