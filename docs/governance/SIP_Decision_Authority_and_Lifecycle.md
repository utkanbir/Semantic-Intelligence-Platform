# SIP Decision Authority and Lifecycle

**Version:** 1.0  
**Status:** Frozen — Governance Sprint v1.0  
**Companion:** [SIP_Architecture_Governance_Policy.md](./SIP_Architecture_Governance_Policy.md)

---

## Part A — Decision Authority Matrix (RACI)

**Accountable (A):** exactly one role owns the final decision.  
**Responsible (R):** does the work or prepares the recommendation.  
**Consulted (C):** provides input before the decision.  
**Informed (I):** notified after the decision.

| Decision | Accountable | Responsible | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| Architecture compliance (module boundaries, ports, layers) | Lead Architect | Engineering office (implementer) | PMO (EM hat) | QA |
| ADR propose / accept / reject | Lead Architect | Lead Architect (draft) | Backend, PMO (EM hat) | QA |
| MVP scope in / out | Product Owner | Product Owner | Lead Architect, PMO | Engineering offices |
| Sprint commitment (which issues) | PMO (DM hat) | PMO (DM hat) | Product Owner, Lead Architect | All offices |
| Issue → engineering office assignment | PMO (EM hat) | PMO (EM hat) | Lead Architect | Product Owner |
| Implementation within approved issue scope | Backend / DevOps / Frontend | Respective office | PMO (EM hat) | Lead Architect |
| Code structure within one module | Backend (or surface owner) | Backend | PMO (EM hat) | Lead Architect |
| CI / pipeline baseline | DevOps | DevOps | Backend, PMO (EM hat) | Lead Architect |
| Kubernetes / Kustomize foundation | DevOps | DevOps | Lead Architect, Backend | PMO |
| Database migration (schema) | Lead Architect | Backend | PMO (EM hat) | QA |
| Routine PR merge (no architecture gate) | PMO (EM hat) or human Tech Lead | Engineering office | QA | Lead Architect |
| PR merge (architecture gate = Yes) | Lead Architect | Engineering office | PMO (EM hat), QA | Product Owner |
| QA sign-off (acceptance criteria) | QA | QA | Engineering office | PMO |
| Release / demo environment promotion | PMO (DM hat) | DevOps | QA, Lead Architect | Product Owner |
| Playbook change | Tech Lead + Lead Architect | PMO | Engineering offices | Product Owner |
| Governance document change | Lead Architect + PMO (DM hat) | PMO | Engineering offices | Product Owner |
| Process change mid-sprint | — | — | — | **Not allowed** (Retro or ADR only) |

### PMO dual hats

The PMO Cursor chat carries two functional hats. Declare the active hat at session start:

| Hat | Authority | Cannot |
|-----|-----------|--------|
| **Delivery Manager (DM)** | Sprint planning, board status, milestones, risk register, release coordination | Implement production code, approve architecture |
| **Engineering Manager (EM)** | Issue→office assignment, WIP limits, PR sequencing, routine merge coordination, escalation to Architect | Change MVP scope, accept ADRs, override architecture gate |

---

## Part B — Decision Lifecycles

A lifecycle describes how a decision **evolves** from trigger to closure. The Matrix says *who*; the lifecycle says *how*.

### L1 — Routine implementation (no architecture gate)

```
Issue (Ready) → PMO (EM) assigns office → Office implements → PR opened
  → Architecture gate? No → QA checklist → PMO (EM) or human merge → Done
```

**Triggers:** bug fix within existing contract, tests, docs, CI config, module-internal refactor, approved skeleton/stub work.

### L2 — Architecture-gated implementation

```
Issue (Ready) → PMO (EM) assigns office → Office implements → PR opened
  → Architecture gate? Yes → Lead Architect review
    → Approve → QA → merge
    → Request changes → office fixes → re-review
    → Veto / ADR required → stop implementation → ADR lifecycle (L3)
```

**Triggers:** see [SIP_Architecture_Governance_Policy.md](./SIP_Architecture_Governance_Policy.md).

### L3 — ADR decision

```
Ambiguity or proposed architecture change detected
  → Lead Architect drafts ADR (Proposed)
  → Architecture review (Accept / Reject / Revise)
  → Accepted ADR merged
  → Implementation issue updated with ADR reference
  → L1 or L2 implementation proceeds
```

**Accountable:** Lead Architect. **No implementation** of the architectural change until ADR is Accepted.

### L4 — New aggregate / domain concept

```
Backend identifies need (issue comment or spike)
  → PMO (EM) triages
  → Lead Architect evaluates (gate before significant code)
    → Existing model covers it → clarify in issue → L1/L2
    → New concept → ADR or architecture addendum (L3) → then implement
```

### L5 — Cross-office dependency

```
Office A blocked by Office B
  → PMO (EM) records dependency (issue link / blocked-by)
  → Sequences PRs (B before A)
  → Escalate to Lead Architect if boundary dispute
```

### L6 — Process or governance change

```
Observation during sprint (friction, repeated failure)
  → Log in retro notes (do not change process mid-sprint)
  → Sprint Retrospective: propose governance/playbook change
  → Lead Architect + PMO (DM) approve
  → PR to docs/governance/ or playbook
  → Effective next sprint
```

**Exception:** Accepted ADR may change process immediately if required for architecture integrity.

---

## Escalation rules

| Situation | Escalate to |
|-----------|-------------|
| Module boundary dispute | Lead Architect |
| Scope creep on issue | Product Owner |
| Office capacity / sequencing conflict | PMO (EM hat) |
| Sprint commitment change | PMO (DM hat) + Product Owner |
| Architecture gate disagreement | Lead Architect (final) |
| QA S2 (architecture rule violation) | Lead Architect + block merge |

---

## Versioning

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-25 | Initial freeze — Governance Sprint v1.0 |

**Next review:** Sprint 2 Retrospective (earliest).
