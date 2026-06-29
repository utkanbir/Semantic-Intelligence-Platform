# Sprint 1 Architecture Clarification — PO Deferral

**Date:** 2026-06-28  
**Sprint:** Sprint 1 — Applications Module  
**Authority:** Product Owner (solo maintainer)  
**Reference:** [SIP_GITHUB_WORKFLOW.md](../project/SIP_GITHUB_WORKFLOW.md) §14, §16 success criteria

---

## Decision

The Sprint 1 clarification backlog from the Architecture Readiness Review is **explicitly deferred to Sprint 2** (docs track). Sprint 1 **Applications module** delivery is not blocked by this deferral because:

- APIs are consumed in **local dev** only (`sip-dev` / TestClient) with no external auth surface.
- SemanticTransaction **stub** on Application create satisfies R-013 minimum for Sprint 1 milestone.
- Discovery and Blueprint modules were not started in Sprint 1.

---

## Deferred items

| Topic | Suggested track | Target sprint |
|-------|-----------------|---------------|
| Ontology / KnowledgeGraph DM aggregates | ADR + DM addendum | Sprint 2–3 |
| Lifecycle transition matrix (Blueprint, Application, Product) | Architecture addendum | Sprint 2 (Blueprint prep) |
| MVP authentication stub | ADR | **Sprint 2 week 1** |
| Data Layer asset ownership (Connector/DataSource) | ADR or MVP deferral | Sprint 4+ |
| SemanticTransaction orchestration (TraceStep, correlation) | ADR | **Sprint 2** |
| MCP implementation placement | ADR | Sprint 2+ |

---

## PO sign-off

| Role | Name | Decision | Date |
|------|------|----------|------|
| Product Owner | Tolga (utkanbir) | **Defer to Sprint 2** — accept Sprint 1 close without Accepted ADRs above | 2026-06-28 |

---

## Conditions for Sprint 2 start

1. **Auth stub ADR** opened and targeted for acceptance before any non-local API exposure or Console integration.
2. **SemanticTransaction orchestration ADR** opened before Discovery module emits trace records beyond read-only paths.
3. No silent code decisions on deferred topics — use `status:needs-architecture` label per workflow §14 escalation flow.

---

## Related deliverables (Sprint 1 — completed)

- [SIP_ApplicationWorkspace_Provisioning_Contract_v1.md](../architecture/SIP_ApplicationWorkspace_Provisioning_Contract_v1.md)
- [Sprint_1_Applications_Module_retro.md](retros/Sprint_1_Applications_Module_retro.md)
- [Sprint_1_architecture_health.md](health-reports/Sprint_1_architecture_health.md)
