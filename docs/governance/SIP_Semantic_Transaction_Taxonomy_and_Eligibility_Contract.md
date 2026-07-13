# SIP Semantic Transaction Taxonomy and Eligibility Contract

**Version:** 1.0 (Sprint 32 — #292)  
**Status:** Draft — architecture review required  
**Authority:** Semantic Transaction Concept v2 (`SIP_Semantic_Transaction_Concept_v2.docx`)  
**Related:** [Semantic_Transaction_Realignment_Gap_Note.md](./Semantic_Transaction_Realignment_Gap_Note.md)

---

## 1. Purpose

This contract defines which persisted trace records qualify as **Semantic Transactions** (semantic lineage) versus **operational audit trace** events. It is the authoritative input for:

- #293 Backend query surface realignment
- #294 Console Semantic Transactions vs Audit Trace split

Implementation must not rely on ad hoc prefix heuristics alone (`transaction_type_prefix=ontology`) once #293 lands.

---

## 2. Core definitions

| Term | Meaning | User-facing surface |
|------|---------|---------------------|
| **Semantic Transaction** | Semantic lineage of a business question, semantic asset journey, or AI reasoning process — how **meaning evolved** | `Semantic Transactions` |
| **Operational audit trace** | Technical or platform event that explains **how software executed** but not semantic meaning evolution | `Audit Trace` / `Operational Trace` |
| **Trace record** | Persisted row in `semantic_transactions` (+ optional `trace_steps`) regardless of eligibility | Internal persistence model |

**Rule:** Every Semantic Transaction is stored as a trace record, but **not every trace record is eligible** for the Semantic Transactions product surface.

---

## 3. Connectors vs Semantic Assets

Per Semantic Transaction Concept §9:

- **Connectors** are platform-level technology integrations (Fuseki, PostgreSQL, Neo4j, MinIO, etc.).
- **Semantic Assets** are business-level knowledge objects (Ontology, Knowledge Graph, Data Product, Agent definition, Published Product, Blueprint, Asset Record when semantically materialized).

**Contract rules:**

1. Connector registration, adapter wiring, and connector provisioning are **operational audit** events unless they are an explicit step inside an ongoing **semantic asset journey** trace (e.g. ontology materialization to Fuseki as a trace step, not as a standalone feed item).
2. Semantic Transactions **connect** assets and connectors in trace steps; they do not collapse connector lifecycle into semantic lineage by default.
3. A trace whose primary subject is a connector or adapter resource type is **operational audit**, not semantic lineage.

---

## 4. Trace classification taxonomy

Every trace record MUST be classifiable into exactly one **trace audience**:

| `trace_audience` | Description |
|------------------|-------------|
| `semantic_lineage` | Eligible for Semantic Transactions surfaces |
| `operational_audit` | Audit Trace / platform operations only |
| `platform_provisioning` | Workspace / infrastructure provisioning; never default Semantic Transactions feed |

**Sprint 32 note:** Classification may initially be derived from this contract table at read time (#293). A persisted column or enum may follow in a later migration; the eligibility rules below are normative regardless of storage mechanism.

### 4.1 Trace layers (`TraceLayer`, S38-01; extended S39-02 per ADR-002)

Multi-step semantic journeys persist each `TraceStep.layer` using the normative enum values below (see `audit_trace/domain/enums.py`). Sprint 39 (S39-02, ADR-002 §"TraceLayer enum extension") extends the original four values to the six-layer routing taxonomy without breaking existing rows:

| `TraceLayer` | Scope | Examples |
|--------------|-------|----------|
| `ExperienceLayer` | User-facing inputs and rendered answers | Question received, answer returned to Console |
| `SemanticLayer` | Intent, routing, and LLM orchestration over semantic assets | Intent analysis, LLM response generation, transaction completion |
| `OntologyLayer` | Ontology structure / concept context retrieval | Ontology class/property/relationship context loaded for grounding |
| `KnowledgeGraphLayer` | Curated knowledge graph traversal | Entity/relationship query against the graph store |
| `InformationLayer` | Business Glossary / Data Catalog context (ADR-005) | Glossary term or catalog metadata resolution |
| `DataLayer` | Physical data access when part of an explainable journey | SQL generated and executed against the customer database |
| `OperationalLayer` | Platform or connector execution only | Connector ping, pod restart — not standalone semantic lineage |

**Legacy value:** `KnowledgeLayer` (S38) remains valid for existing rows and denotes ontology/graph context retrieval. New writes SHOULD use `OntologyLayer` for ontology-structure grounding and `KnowledgeGraphLayer` for graph traversal. Readers MUST accept both `KnowledgeLayer` and `KnowledgeGraphLayer`.

**Rule:** Semantic Transactions surfaces show steps from all layers when they explain a semantic journey; `OperationalLayer` steps alone do not create `semantic_lineage` eligibility.

---

## 5. Semantic layers and routing (eligibility context)

Semantic Transactions record the **minimum semantic path actually taken** (Concept §4, §12–§13). Eligible transactions typically involve one or more of:

| Layer | Examples in trace steps |
|-------|-------------------------|
| Semantic routing | Route selection, scope resolution |
| Ontology | Concept resolution, class/relationship materialization |
| Knowledge graph | Entity/relationship traversal |
| Semantic layer / Data Product | Product selection, metric resolution |
| Agent / reasoning | Agent run orchestration tied to semantic output |
| Data layer | Physical query steps **when part of an explainable semantic journey** |

Pure infrastructure steps (DB migration, pod restart, connector ping) are never standalone semantic lineage.

---

## 6. Eligibility matrix (current `transaction_type` values)

Normative classification for types emitted by the codebase today:

### 6.1 Semantic lineage (`semantic_lineage`)

Platform and application **Semantic Transactions** surfaces expose ontology lineage only:

| `transaction_type` | `resource_type` | Rationale |
|--------------------|-----------------|-----------|
| `ontology.created` | `OntologyDefinition` | Semantic asset origin |
| `ontology.imported` | `OntologyDefinition` | Semantic asset materialization journey |
| `ontology.updated` | `OntologyDefinition` | Meaning evolution |
| `ontology.status_changed` | `OntologyDefinition` | Lifecycle of semantic asset |
| `ontology.version_forked` | `OntologyDefinition` | Lineage branch of semantic asset |
| `ontology.published` | `OntologyDefinition` | Semantic asset publication |
| `ontology.validation_run` | `OntologyDefinition` | Structural validation journey |
| `ontology.generated` | `OntologyDefinition` | Generate-from-Sources draft creation |
| `ontology.suggestion_reviewed` | `OntologyDefinition` | Advisory semantic review decision |
| `ontology.connector_selected` | `OntologyDefinition` | Graph store connector selection |
| `ontology.materialized` | `OntologyDefinition` | Draft materialization to knowledge graph |
| `ontology.question_answered` | `OntologyDefinition` | Grounded ontology Q&A (chat over structure; S38) |

### 6.2 Operational audit (`operational_audit`)

| `transaction_type` | `resource_type` | Rationale |
|--------------------|-----------------|-----------|
| `adapter.registered` | `TechnologyAdapter` | Platform integration wiring |
| `connector.provisioned` | `TechnologyAdapter` | Connector infrastructure event |
| `knowledge_graph.created` | `KnowledgeGraphRegistry` | Module lifecycle; visible in Audit trace |
| `product.created` | `PublishedDataProduct` | Module lifecycle; visible in Audit trace |
| `asset.created` | `AssetRecord` | Module lifecycle; visible in Audit trace |
| `blueprint.created` | `Blueprint` | Module lifecycle; visible in Audit trace |
| `discovery.session.created` | `DiscoverySession` | Module lifecycle; visible in Audit trace |
| `agent.created` | `AgentDefinition` | Module lifecycle; visible in Audit trace |
| `agent.run.started` | `AgentRun` | Runtime event; visible in Audit trace |
| `policy.created` | `PolicyDefinition` | Governance event; visible in Audit trace |

### 6.3 Platform provisioning (`platform_provisioning`)

| `transaction_type` | `resource_type` | Rationale |
|--------------------|-----------------|-----------|
| `ApplicationWorkspaceProvisioned` | `Application` | Workspace bootstrap, not semantic lineage |

### 6.4 Default rule for new types

When adding a new `transaction_type`:

1. Declare intended `trace_audience` in the module PR (architecture gate if new domain event).
2. If the event explains **meaning evolution** for a semantic asset or reasoning path → `semantic_lineage`.
3. If the event explains **connector/platform execution** only → `operational_audit` or `platform_provisioning`.
4. Do not add prefix-based UI filters as a substitute for this declaration.

---

## 7. Read surface contract (input for #293)

| Surface | API (target) | Filter |
|---------|--------------|--------|
| **Semantic Transactions** | Dedicated read contract (recommended: `GET /api/v1/semantic-transactions`) **or** audit-traces with mandatory `trace_audience=semantic_lineage` | Only `semantic_lineage` rows |
| **Audit Trace** | `GET /api/v1/audit-traces` | All trace records; optional filters by `trace_audience`, `resource_type`, `application_id`, `resource_id` |

**Prohibited:** Using unfiltered `GET /api/v1/audit-traces` as the Semantic Transactions feed.

**Deprecated heuristic:** `transaction_type_prefix=ontology` as the sole Semantic Transactions filter — acceptable only until #293 ships; must not be documented as the long-term contract.

---

## 8. Console contract (input for #294)

| Route | Label | Data source |
|-------|-------|-------------|
| `/semantic-transactions` | Semantic Transactions | Semantic lineage read surface only |
| `/audit-trace` | Audit Trace | Full operational + semantic trace explorer |

Ontology Wizard success links may deep-link to **Semantic Transactions** for the ontology journey transaction, not to a generic audit list.

---

## 9. Trace step expectations for semantic lineage

Semantic lineage transactions SHOULD include ordered trace steps that name:

- **`TraceStep.layer`** — one of §4.1 (six-layer taxonomy; legacy `KnowledgeLayer` accepted)
- **`TraceStep.status`**, **`input_summary`**, **`output_summary`**, **`duration_ms`** when the journey is multi-step (S38-01 schema)
- Semantic asset reference (ontology IRI, product id, agent id)
- Connector reference **as a step**, when a physical system was involved
- Input/output artifact references where applicable

Operational-only transactions MAY have zero or minimal steps; they remain ineligible for Semantic Transactions regardless.

### 9.1 trx_main first-class fields (S39-01/S39-03, ADR-002)

Question and answer text, timing, and execution mode are **first-class columns on the `semantic_transactions` row (trx_main)** — not derived from trace step summaries. Trace step `input_summary` / `output_summary` remain truncated denormalized hints; trx_main is authoritative for the full text.

| Field | Type | Meaning |
|-------|------|---------|
| `question_text` | text, nullable | Full user question (untruncated) |
| `answer_text` | text, nullable | Full generated answer (untruncated) |
| `started_at` | timestamptz, nullable | Wall-clock start of the transaction |
| `completed_at` | timestamptz, nullable | Wall-clock completion (set on success and failure) |
| `total_duration_ms` | integer, nullable | End-to-end duration for the transaction |
| `mode` | string, nullable | Execution mode: `Rich` (full semantic stack) or `Bare` (LLM + Database baseline, Compare Mode). Ontology structure-only chat records `Rich`. |

**Rules:**

1. All trx_main fields are nullable so existing rows (pre-S39-01) remain valid.
2. Consumers MUST read full question/answer from trx_main, not from trace step summaries.
3. `mode` values are constrained to the `SemanticTransactionMode` enum (`Rich`, `Bare`).
4. Fields reserved by ADR-002 but out of Sprint 39 scope — `cost_estimate` / `total_cost_estimate` (S40), `conversation_id` (S40), `comparison_id` (Compare Mode), `sandbox_id` (ADR-003) — are documented in their own sprint updates when landed.

---

## 10. Governance references

- Concept source: `SIP_Semantic_Transaction_Concept_v2.docx`
- Gap analysis: [Semantic_Transaction_Realignment_Gap_Note.md](./Semantic_Transaction_Realignment_Gap_Note.md)
- Architecture governance: [SIP_Architecture_Governance_Policy.md](./SIP_Architecture_Governance_Policy.md)
- Sprint 32 epic: GitHub #291

---

## 11. Acceptance mapping (#292)

| Acceptance criterion | Section |
|----------------------|---------|
| Distinguish semantic lineage from operational audit | §2, §4 |
| Eligibility for semantic assets, routing, reasoning paths | §5, §6.1 |
| Connector vs Semantic Asset clarified | §3 |
| Follow-up issues can implement without prefix guessing | §6, §7 |
| Architecture / governance references linked | §10 |
