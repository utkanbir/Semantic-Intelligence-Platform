# SIP Architecture Governance Policy

**Version:** 1.0  
**Status:** Frozen — Governance Sprint v1.0  
**Companion:** [SIP_Decision_Authority_and_Lifecycle.md](./SIP_Decision_Authority_and_Lifecycle.md)

---

## Purpose

The Lead Architect **governs** architecture — approves, vetoes, directs, records debt, and opens ADRs. Governance is **event-driven** (per PR), not sprint-driven.

Sprint-end **Architecture Health Check** (see `health-reports/`) is a separate, periodic review of trends — not a substitute for per-PR gates.

---

## Event-driven PR flow

Every PR targeting `develop` (or `main` for hotfix) must answer:

> **Does this PR affect architecture?**

Record the answer in the PR body using the template in Section 4.

```
PR opened
    │
    ▼
Does this PR affect architecture?  (Section 2)
    │
    ├─ No ──► QA checklist + office review ──► merge (L1 lifecycle)
    │
    └─ Yes ─► Architecture Review Required
                  │
                  ▼
              Lead Architect decision
                  │
                  ├─ Approve ──► QA ──► merge
                  ├─ Request changes ──► author fixes ──► re-review
                  ├─ Require ADR ──► L3 lifecycle ──► implement after ADR Accepted
                  └─ Reject (boundary violation) ──► do not merge
```

---

## Architecture gate triggers

If **any** item below applies, the PR **affects architecture** (gate = **Yes**):

| # | Trigger |
|---|---------|
| 1 | New backend module or removal of a canonical module |
| 2 | New aggregate, entity, or lifecycle state not in frozen domain model |
| 3 | Change to module dependency direction (import/call across module boundaries) |
| 4 | New or changed port interface in `shared/`, `core/`, or `infrastructure/` |
| 5 | New public API route group under `/api/v1` (new resource domain) |
| 6 | Change to ApplicationWorkspace namespace fields (ARR-001) |
| 7 | Asset lifecycle transition rules (ARR-002) |
| 8 | Database migration adding tables/columns with cross-module impact |
| 9 | MCP exposure or internal MCP usage (API-001 violation risk) |
| 10 | Direct technology client usage bypassing ports (R-018) |
| 11 | SemanticTransaction / TraceStep pattern change (R-013, R-014) |
| 12 | Kubernetes namespace, network boundary, or security baseline change |
| 13 | Any deviation from ARR-001–ARR-004 or accepted ADRs |

### Gate = No (routine) examples

- Module-internal refactor preserving boundaries
- Tests, fixtures, CI workflow (no boundary impact)
- README, comments, non-authoritative docs
- Bug fix within existing API contract and domain model
- Stub/skeleton files matching approved module template (S0-04 pattern)
- Implementation explicitly covered by an **Accepted** ADR with no new ambiguity

**When uncertain:** treat as **Yes** and escalate to Lead Architect.

---

## Lead Architect powers

| Action | When |
|--------|------|
| **Approve** | PR complies with architecture and ADRs |
| **Request changes** | Fixable violation or missing traceability |
| **Require ADR** | Ambiguity or new pattern not yet recorded |
| **Veto** | Boundary violation; merge blocked |
| **Record technical debt** | Acceptable shortcut with documented follow-up (`health-reports/` or issue) |
| **Waive gate** | Documented exception with rationale in PR (rare) |

---

## PR body template (architecture section)

Add to every implementation PR:

```markdown
## Architecture gate

- [ ] I assessed this PR against SIP_Architecture_Governance_Policy v1.0
- **Gate required:** Yes / No
- **Triggers (if Yes):** <!-- list numbers from Section 2 -->
- **ADR reference (if any):** <!-- ADR-NNN or N/A -->
- **Architecture refs:** <!-- R-*, DM-*, ARR-*, ADR-* -->
```

Lead Architect adds when gate = Yes:

```markdown
## Architecture review (Lead Architect)

- **Decision:** Approve / Request changes / Require ADR / Reject
- **Notes:**
```

---

## Architecture Health Check (sprint-end)

Separate from per-PR review. Conduct at Sprint Review or immediately after.

**Inputs:** merged PRs, open issues, retro notes, QA findings.

**Outputs:** file in `docs/governance/health-reports/` using the template.

**Topics:**

| Topic | Question |
|-------|----------|
| Technical debt | What shortcuts were accepted? |
| Boundaries | Any cross-module coupling introduced? |
| ADRs | New ADRs needed or proposed? |
| Dependencies | Dependency direction violations? |
| Namespaces | ApplicationWorkspace / K8s namespace issues? |
| Domain model | Drift from `SIP_Domain_Model_v1`? |
| Gate effectiveness | False positives/negatives on architecture gate? |
| Gate trigger #11-class | Health report §9 checklist complete; Green only if all Pass/N/A (S36-03) |

---

## Relationship to frozen architecture

| Source | Role |
|--------|------|
| `architecture/*.docx` | Canonical platform behavior and structure |
| `docs/architecture/SIP_Architecture_Review_Resolution_v1.md` | ARR-001–ARR-004 binding resolutions |
| `docs/adr/` | Implementation-time decisions (e.g. ADR-001) |
| This policy | How architecture is enforced during delivery |

---

## Versioning

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-25 | Initial freeze — Governance Sprint v1.0 |

**Next review:** Sprint 2 Retrospective (earliest).
