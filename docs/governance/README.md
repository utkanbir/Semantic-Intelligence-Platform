# SIP Governance

**Version:** 1.0 (frozen)  
**Status:** Authoritative — organizational governance supplement  
**Audience:** Lead Architect, Product Owner, PMO, Engineering offices, QA  
**Scope:** Defines **who decides what** and **how architecture is governed** during SIP delivery. Does not define platform behavior.

---

## Purpose

SIP development uses AI-assisted engineering offices (Backend, DevOps, Frontend) coordinated through PMO and governed by the Lead Architect. These documents capture **organizational memory** — decision authority, architecture gates, and retrospective outputs — separate from product architecture in `architecture/`.

> **Organisation is proven in sprints, not in meetings.** Governance v1.0 is frozen after the Governance Sprint. Changes require Sprint Retrospective decision or an accepted ADR.

---

## Document set (v1.0)

| Document | Purpose |
|----------|---------|
| [Project handoff](../handoff.md) | Current sprint state, live env, onboarding |
| [SIP_Decision_Authority_and_Lifecycle.md](./SIP_Decision_Authority_and_Lifecycle.md) | RACI matrix + decision lifecycles |
| [SIP_Architecture_Governance_Policy.md](./SIP_Architecture_Governance_Policy.md) | Event-driven PR architecture gate |
| [retros/](./retros/) | Sprint retrospective records |
| [health-reports/](./health-reports/) | Sprint-end architecture health reports |

---

## Authority hierarchy

When governance questions arise, consult in this order:

1. `architecture/` — frozen MVP architecture (`.docx` specifications)
2. `docs/architecture/` — ARR resolutions
3. `docs/adr/` — accepted ADRs
4. `docs/project/SIP_DEVELOPMENT_PLAYBOOK.md` — engineering process
5. **This folder** — decision authority and architecture governance
6. `docs/project/SIP_GITHUB_WORKFLOW.md` — GitHub delivery workflow

If governance practice conflicts with architecture, **architecture wins**.

---

## Governance Sprint v1.0 — Definition of Done

- [x] Decision Authority and Lifecycle document written
- [x] Architecture Governance Policy written
- [x] Retro and Architecture Health Report templates created
- [x] Playbook references governance documents
- [x] Cursor rules include Authority Contract preambles
- [x] Governance v1.0 frozen on merge of `feature/governance-v1`

**Next change window:** Sprint 2 Retrospective (earliest). No mid-sprint governance changes.

---

## Success criteria (observe in Sprint 1–2)

Governance v1.0 is successful if:

1. Lead Architect did **not** review every PR — only architecture-gated PRs
2. PMO chat did **not** write production code
3. Backend chat did **not** approve ADRs or change domain model
4. At least one PR was escalated to the correct role per the Authority Matrix
5. Event-driven architecture gate ran at least once (gate = No and gate = Yes)

Evaluate these questions in the Sprint 2 Retrospective before proposing Governance v1.1.

---

## Complexity filter

Before adding governance artifacts, ask:

> *Does this make the organization more correct, or merely more complex?*

Prefer fewer chats, fewer documents, and explicit decision owners over additional process layers.
