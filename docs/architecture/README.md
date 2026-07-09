# SIP Architecture Supplements (Markdown)

**Purpose:** Binding engineering contracts and living architecture notes that supplement the frozen MVP specifications in `architecture/*.docx`.

**Start here for code navigation:** [SIP_Software_Architecture_Guide.md](./SIP_Software_Architecture_Guide.md)  
**Start here for project state:** [handoff.md](../handoff.md)

---

## Document authority order

1. `architecture/*.docx` — frozen MVP (Lead Architect authority)
2. `docs/architecture/SIP_Architecture_Review_Resolution_v1.md` — ARR-001–ARR-004
3. **This folder** — per-domain contracts and supplements
4. `docs/adr/` — implementation-time decisions (e.g. ADR-001 Kubernetes)
5. `docs/governance/` — process and retros (not product behavior)

If a supplement conflicts with `.docx` specs, **escalate to Lead Architect** — do not silently override.

---

## Index

| Document | Domain | Status notes |
|----------|--------|--------------|
| [SIP_Software_Architecture_Guide.md](./SIP_Software_Architecture_Guide.md) | Codebase layout, layers, modules | **Living** — update when structure changes |
| [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md) | ARR-001–004 resolutions | Frozen |
| [SIP_ApplicationWorkspace_Provisioning_Contract_v1.md](./SIP_ApplicationWorkspace_Provisioning_Contract_v1.md) | Workspace namespaces | Current |
| [SIP_Asset_Registry_Contract_v1.md](./SIP_Asset_Registry_Contract_v1.md) | Assets module | Current |
| [SIP_Blueprint_Lifecycle_Contract_v1.md](./SIP_Blueprint_Lifecycle_Contract_v1.md) | Blueprints | Current |
| [SIP_Discovery_Workflow_Contract_v1.md](./SIP_Discovery_Workflow_Contract_v1.md) | Discovery | Current |
| [SIP_Ontology_Definition_Contract_v1.md](./SIP_Ontology_Definition_Contract_v1.md) | Ontology lifecycle | **See § addendum S34** — draft-first wizard superseded import-centric flow |
| [SIP_Knowledge_Graph_Contract_v1.md](./SIP_Knowledge_Graph_Contract_v1.md) | Knowledge graph registry | Current |
| [SIP_Published_Data_Product_Contract_v1.md](./SIP_Published_Data_Product_Contract_v1.md) | Data products | Current |
| [SIP_Agent_Definition_Contract_v1.md](./SIP_Agent_Definition_Contract_v1.md) | Agent definitions | Current |
| [SIP_Agent_Runtime_Contract_v1.md](./SIP_Agent_Runtime_Contract_v1.md) | Agent runs | Current |
| [SIP_Technology_Adapter_Contract_v1.md](./SIP_Technology_Adapter_Contract_v1.md) | Connectors/adapters | Superseded in UI by [Semantic Connector Supplement](./SIP_Semantic_Connector_Supplement_v1.md) |
| [SIP_Semantic_Connector_Supplement_v1.md](./SIP_Semantic_Connector_Supplement_v1.md) | Unified connectors + ontology tx | **Updated S35** — Fuseki write + wizard no longer deferred |
| [SIP_Governance_Policy_Contract_v1.md](./SIP_Governance_Policy_Contract_v1.md) | Policy definitions | Current |
| [SIP_Assessment_MVP_E2E_Scenario_v1.md](./SIP_Assessment_MVP_E2E_Scenario_v1.md) | E2E demo scenario | Current |

---

## Governance cross-references

| Document | Location |
|----------|----------|
| Semantic transaction taxonomy | `docs/governance/SIP_Semantic_Transaction_Taxonomy_and_Eligibility_Contract.md` |
| Architecture gate policy | `docs/governance/SIP_Architecture_Governance_Policy.md` |
| Decision authority | `docs/governance/SIP_Decision_Authority_and_Lifecycle.md` |

---

## Staleness watchlist

Documents most likely to drift from implementation:

1. **SIP_Ontology_Definition_Contract_v1.md** — Sprint 34–35 added draft-first lifecycle, generate mode, LLM review, materialize split. Rely on **§ Addendum S34** at document end.
2. **SIP_Semantic_Connector_Supplement_v1.md** — "Deferred" section listed Fuseki write and LLM extraction; both shipped in Sprints 30–35.
3. **Root README.md** — sprint table; updated through Sprint 35.

When implementing ontology or connector features, update the relevant supplement **in the same PR** or file a follow-up docs issue.
