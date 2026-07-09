# Architecture Health Report — Sprint N

**Date:** YYYY-MM-DD  
**Sprint:** Sprint N — \<theme\>  
**Author:** Lead Architect  
**Companion:** [SIP_Architecture_Governance_Policy.md](../SIP_Architecture_Governance_Policy.md)

**Closed-sprint edits (S37-08):** After merge, any change to this file MUST include an inline blockquote on the edited section: `> Correction (YYYY-MM-DD, #issue): <reason>`.

---

## 1. Summary

One paragraph: overall architecture health this sprint (Green / Amber / Red).

**Green constraint (Sprint 36+):** Allowed only when §9 Gate trigger #11-class checklist has no **Fail** results.

---

## 2. Merged PRs reviewed

| PR | Issue | Gate (Y/N) | Architect review | Outcome |
|----|-------|------------|------------------|---------|
| #NN | #NN | | Yes/No | |

---

## 3. Technical debt register

| ID | Description | Introduced in | Severity | Remediation issue |
|----|-------------|---------------|----------|-------------------|
| TD-001 | | PR # / issue # | S2/S3 | |

---

## 4. Boundary and dependency review

| Module / area | Concern | Status |
|---------------|---------|--------|
| | | Open / Resolved |

---

## 5. ADR status

| ADR | Status | Notes |
|-----|--------|-------|
| | Proposed / Accepted / Superseded | |

**New ADR needs identified:**

-

---

## 6. Namespace and infrastructure

| Topic | Finding |
|-------|---------|
| ApplicationWorkspace (ARR-001) | |
| Kubernetes namespaces (ADR-001) | |

---

## 7. Domain model alignment

Drift from `SIP_Domain_Model_v1` (if any):

-

---

## 8. Gate effectiveness

| Metric | Value |
|--------|-------|
| PRs with gate = Yes | |
| PRs with gate = No | |
| False positives (gate Yes, unnecessary) | |
| False negatives (gate No, should have been Yes) | |

**Policy adjustment for v1.1?** Yes / No — defer to Sprint 2+ retro if insufficient data.

---

## 9. Gate trigger #11-class checklist (required Sprint 36+)

Policy trigger **#11** covers SemanticTransaction / TraceStep pattern changes (R-013, R-014). **#11-class** extends to related semantic-surface hygiene — e.g. Console labels vs taxonomy contract (Sprint 31 TD-017 incident).

**Rating rule:** Section 1 may be **Green** only when every applicable row below is **Pass** or **N/A** (no **Fail**).

| ID | Check | Result (Pass / Fail / N/A) | Evidence / Notes |
|----|-------|----------------------------|------------------|
| G11-1 | SemanticTransaction / TraceStep write paths unchanged, or gate-Yes PR(s) reviewed per policy trigger #11 | | |
| G11-2 | New/changed Console labels for semantic lineage align with taxonomy/ontology contract (no `audit_trace` ↔ semantic conflation) | | |
| G11-3 | New semantic read/write routes documented in the relevant module contract | | |
| G11-4 | `trace_audience` / lineage classification matches contract (persisted on write when required) | | |

**Pass rows (Sprint 37+):** Evidence column must cite a file path, PR (`#NNN`), or test name. Reviewer spot-checks at least one link before accepting Green.

**Section 1 summary line must cite this table** when rated Green (e.g. "Green — §9 gate-trigger-11 checklist: all Pass/N/A").

---

## 10. Risks for next sprint

| Risk | Impact | Mitigation |
|------|--------|------------|
| | | |
