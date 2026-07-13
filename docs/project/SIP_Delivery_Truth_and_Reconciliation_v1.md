# SIP Delivery Truth & Reconciliation (v1)

**Status:** Draft — independent reconciliation (not yet PO/Architect-signed)
**Date:** 2026-07-08
**Method:** STA reality-first — code state read directly, then reconciled against the frozen contracts. No claim in this doc is taken from a spec without a code check.
**Scope:** Platform-wide build state as of Sprint 35 (`20260706_0019`).
**Rebased:** 2026-07-09 to Sprint 36 (`fed536a`) — see **§0**. Application code (`backend/app`, migrations, deps) unchanged, so every build-state finding below still holds.
**Companion contracts reconciled:** [Ontology](../architecture/SIP_Ontology_Definition_Contract_v1.md) · [Knowledge Graph](../architecture/SIP_Knowledge_Graph_Contract_v1.md) · [Agent Runtime](../architecture/SIP_Agent_Runtime_Contract_v1.md) · [Technology Adapter](../architecture/SIP_Technology_Adapter_Contract_v1.md) · [MVP Checklist](./SIP_MVP_v1_Release_Checklist.md)

---

## 0. Sprint 36 reconciliation (2026-07-09)

Rebased from Sprint 35 to **Sprint 36** (`fed536a`). Sprint 36 is a **Governance Remediation** sprint that, by its own plan, *"does not add product features"* — no changes to `backend/app`, migrations, or dependencies. **Every build-state and reconciliation finding in §3–§6 therefore still holds unchanged** (agent execution stub, LLM stub, no auth, plaintext creds, KG population deferred, ontology lifecycle stops at Approved). The new `SIP_Software_Architecture_Guide.md` independently corroborates the module/port structure described here.

What Sprint 36 **did** change is the *governance process* this document critiques in §1 and §7 — and it moves in the direction §7 recommended:

| §1 / §7 critique | Sprint 36 response | Status |
|---|---|---|
| Deferrals "silently drop off" (TD-007/auth did) | **Deferred Items Ledger** (`scripts/deferred_items_ledger.json` + `docs/governance/SIP_Deferred_Items_Ledger.md`) + CI gate (`verify_sprint_deferrals.py`) forcing every deferral → a GitHub issue with a milestone | **Adopted** (S36-02); TD-007 back on ledger as **#343** |
| Sprint-close gates self-reported, not enforced | `verify_sprint_close_ci.py` wired as a required CI check | **Adopted** (S36-01) |
| §7.4 contract↔code reconciliation gate | Contract-sync CI check diffing live `/api/v1` routes vs `*_Contract_*.md` | **Planned** (S36-05, #340) |

Reconciling this doc's **proposed TD-022…027** (§5) against the seeded ledger and Sprint 36 scope:

| Proposed | Now |
|---|---|
| **TD-007** (auth stub ADR) | On their ledger (**#343**) — tracked; ADR still unwritten, no code auth yet |
| **TD-026** (LLM always stub) | Acknowledged — S36-06 will wire a real provider **or** rename the feature |
| **TD-027** (contract↔code drift) | Being addressed generically by the S36-05 contract-sync check; the specific ontology `Published/Versioned` drift persists until code changes |
| **TD-022** plaintext connector creds · **TD-023** actor-less audit · **TD-024** no optimistic locking · **TD-025** no app logging | **Still not on any ledger, still unremediated** — these remain this document's net-new contribution and should be filed as issues |

**Net:** the *process* gap this document flagged is closing; the *runtime and security* gaps are untouched. The forward plan (§6, W1–W4) stands in full.

---

## 1. Why this document exists

SIP documents **intent** (contracts), **history** (retros, health reports), and **decisions** (D/R/TD registers) rigorously — but it has **no single, current artifact that states what is actually built vs. specced vs. next.** The MVP checklist is a Sprint-12 snapshot that went stale; deferrals are tracked as debt rows that can silently drop off (TD-007/auth did). Consequently a reader of the contracts will believe features exist that the code does not implement.

This doc is that missing artifact. It is deliberately **STA-shaped**: reality-first (§3–§4), reconciled against the contracts (§4), honest about un-tracked gaps (§5), and forward-planned with **machine-checkable acceptance criteria and two-question routing** (§6), plus the operating discipline to keep it true (§7). It is intended to be **living** — updated at each sprint close, not frozen.

---

## 2. How to read the state column

| State | Meaning |
|-------|---------|
| **Real** | Genuine runtime effect (DB / network / file) |
| **Governed-only** | Real CRUD + lifecycle state machine + trace, but **no physical effect** |
| **Stub** | Executes but returns canned/echoed output; no real work |
| **Absent** | Not implemented; only a reserved name or nothing at all |

---

## 3. Build-state matrix (per capability)

| Capability | State | Evidence (file) |
|---|---|---|
| Postgres persistence (all governance state) | **Real** | SQLAlchemy repositories, `20260706_0019` |
| Ontology → Fuseki **materialize** (RDF write) | **Real** | `infrastructure/adapters/fuseki.py:190-229` |
| RDF structural validation (rdflib) | **Real** | `modules/ontology/services/ontology_validation_service.py` |
| Connector ping: Postgres / Fuseki | **Real** | `adapter_stubs.py:20-22` (SELECT 1); `fuseki.py:117-137` (HTTP) |
| Audit-trace read model | **Real** (but actor-less — §5) | `modules/audit_trace/api/routes.py` |
| Applications / workspace provisioning | **Governed-only** | namespaces are strings; `namespace_builder.py:37-52` — no infra created |
| Discovery · Blueprint · Assets | **Governed-only** | records + state machines only |
| Ontology (pre-materialize) · KG registry | **Governed-only** | KG never writes a triple; `triple_count` fixed 0 |
| Data Products ("publish") | **Governed-only** | `products_service.py:212-214` — stamps status; serves no data; **no ontology/KG link** |
| Agents (definitions) · Governance policies | **Governed-only** | policies are inert records; never evaluated |
| **Agent execution** | **Stub** | `agent_runtime_service.py:132-150` — `"stub_completed"`, echoes payload |
| **LLM** (generate + AI review) | **Stub** (always) | `llm_resolver.py:10-16` returns `StubLLMAdapter()` **even when a provider is configured** |
| Connector provision (in-cluster) | **Stub** | `connector_provision.py:41-59` — writes fake "provisioned" block |
| Connector ping: object / vector / file-system | **Stub** | `adapter_stubs.py:25-27,70-77` — hardcoded `{"status":"ok"}` |
| KG population (A-Box) | **Absent** | no loader anywhere; `triple_count` never updated |
| Vectors (Qdrant) · Object storage (MinIO) | **Absent** | reserved namespace names only; no client imported |

**One-line truth:** SIP is a well-built **governed-metadata skeleton**. Every capability branded "intelligence" (agents, LLM, vectors, KG population) is a stub or absent. The only physical semantic write in the whole system is `ontology.materialize` → Fuseki (T-Box only).

---

## 4. Contract ↔ code reconciliation (where the docs overstate reality)

These are the dangerous gaps: the contract reads as if the feature works.

| Contract claim | Code reality | Impact |
|---|---|---|
| Ontology lifecycle `Draft→Validated→Approved→Published→Versioned→Retired` (Ontology Contract §5.1) | `VALID_STATUS_TRANSITIONS` makes **`Approved` terminal**; `published_at` is dead code (`ontology_service.py:1085-1097`) | **Published / Versioned / Retired unreachable; version-fork unreachable.** A reader believes publish/versioning works. |
| KG binds **Published/Versioned** ontologies (KG Contract §4.3) | code `BINDABLE_ONTOLOGY_STATUSES` also allows **Approved** (`knowledge_graph_service.py:25-29`) | Contract and code disagree on the binding rule. |
| KG "Populated" status | `triple_count` never updated; A-Box never loaded | "Populated" is a status flag, **not a populated graph**. |
| `adapter_configuration` is **"non-secret connection metadata"** (Adapter Contract §4) | connector **passwords stored plaintext** in that JSON column (`adapters/repositories/orm_models.py:48`; read `fuseki.py:45-53`) | **Security misstatement** — real credentials in a column the contract says holds no secrets. |
| Configurable LLM provider (`SIP_LLM_PROVIDER`) | `llm_resolver.py:16` returns the stub on **every** branch | An integrator who sets a provider still gets canned output, silently. |
| Agent run executes against bound products (Agent Runtime Contract) | run enforces bindings then returns `"stub_completed"` echo | The consumption path — the platform's thesis — is not exercised. |

---

## 4a. The missing ingestion flow — data → ontology (added 2026-07-09)

A "semantic intelligence platform" implies a spine: **data sources → derive an ontology → populate a graph → serve consumers.** SIP has built only the *middle write* — a **hand-authored or file-imported** ontology, materialized (T-Box) to Fuseki. **Three links of that spine are missing:**

1. **Data → ontology (the ingestion end) — designed at the phase level, unbuilt, and unwired to connectors.** The Discovery contract (`SIP_Discovery_Workflow_Contract_v1` §4) *designs* it: Phase 3 **Knowledge Discovery** ("inventory existing knowledge sources, documents, and data"), Phase 5 **Semantic Discovery** ("identify concepts, entities, relationships"), Phase 6 **Blueprint Draft Generation**, Phase 8 **Semantic Design** ("formalize ontology"). But that contract §2 marks **"automated phase content generation," "LLM conversation orchestration,"** and ontology population **out of scope**. In code, the phases are **named labels you advance past**; intent is captured as **free-text** (`intent_summary`, `discovery_notes`). **No connector is ever introspected** — DB connectors are *pinged only* (`SELECT 1`), and the Adapter/Connector contracts contain **no schema-scan language**. The only "Generate ontology" mode reads **documents/URLs, not DB schemas**, and runs on the **LLM stub**. → the scout-data → derive-ontology flow exists only as phase names.
2. **Ontology/KG → product/agent (consumption).** Undesigned — **Decision 1**.
3. **Rows → instance triples (A-Box population).** Deferred — **Decision 2**.

**Also confirmed unbuilt (engine + UI):**
- **No ontology *reasoning* engine.** The stack is `rdflib` (parse/serialize) + deterministic structural validation + Fuseki materialize — **no OWL reasoner, no SHACL, no inference**. The "LLM semantic review" is advisory and stubbed.
- **No view / edit / curate UI for a created ontology.** The Console has a create **wizard** (`OntologyStudioPage`), a list, and a validation page — but **no ontology detail/viewer page and no post-create edit flow** (`updateOntology` exists in the API client but no UI uses it). The KG contract §2 explicitly defers the **"KG Explorer UI."** So Console records are effectively **create-only**; you cannot inspect or refine what was made.

**Impact:** the platform can neither *derive* meaning from data nor *deliver* it, and cannot *reason over* or *curate* what it stores — it hand-authors a T-Box and files it. The "intelligence" is bracketed by governance on both ends but never flows through. This is arguably the **most fundamental gap for the product category** and belongs above Decisions 1–2 in any forward plan.

---

## 5. Blind spots — real gaps in **no** existing register (proposed new TD entries)

Written in the repo's tech-debt format so they can be dropped straight onto the active register. **TD-007 (auth) should also be re-instated** — it fell off the register by Sprint 35.

| Proposed ID | Description | Severity | Evidence |
|---|---|---|---|
| **TD-022** | Connector credentials stored **plaintext** at rest in `adapter_configuration`; contract mislabels the column "non-secret" | **High** | `orm_models.py:48`; Adapter Contract §4 |
| **TD-023** | Audit / SemanticTransaction records carry **no actor identity**; `created_by` is unauthenticated free text — "who did this?" is unanswerable | **High** | `audit_trace/domain/models.py:22-33`; `adapters/api/schemas.py:36` |
| **TD-024** | **No optimistic locking / concurrency control** — last-write-wins on every aggregate (`version_number` is *forking*, not locking) | **High** | `agents/repositories/sqlalchemy_repository.py:96` |
| **TD-025** | **No application logging / observability** — zero `logging`/`getLogger` in the backend | **Medium** | grep: no matches |
| **TD-026** | LLM adapter is **always** the stub regardless of configured provider — misleading | **Medium** | `llm_resolver.py:10-16` |
| **TD-027** | Contract↔code drift: ontology `Published/Versioned/Retired` + version-fork specced but unreachable | **Medium** | `ontology_service.py:1085-1097` |

**Security posture, stated plainly:** with **no authentication or authorization anywhere** (the only `Depends` is `get_db`), the per-app namespaces are organizational only — any caller supplies any `application_id` and reads/writes any tenant's data. SIP is safe **only** as a single-user local demo. Any shared/network deployment is an immediate S1 exposure. This is the downstream consequence of TD-007 that the docs never draw out.

---

## 6. Forward plan (prioritized, acceptance-defined, STA-routed)

Each workstream carries the **two-question routing** that decides *how* it should be built:
**Q1** = is "correct/done" machine-verifiable by a test? **Q2** = is it irreversible / high-blast-radius if wrong?

### W1 — Real agent consumption of the semantic layer  ·  **Priority 1**
*Goal:* an agent run that actually retrieves from the ontology/KG (SPARQL over Fuseki) + a real LLM adapter, and returns a grounded answer — proving or disproving the platform thesis.
*Why first:* nothing today consumes the semantic layer, so the entire value proposition is unproven. Depends on a real LLM adapter + a product→ontology link that does not yet exist.
*Routing:* **Q1 = partly NO** (whether the semantic grounding *helps* is a quality judgment, not a unit assertion) → **build with a small eval harness / golden set**, not just unit tests. **Q2 = No** (dev feature, reversible).
*Acceptance:*
- [ ] `agent_runtime` executes a real retrieval (SPARQL query hits the app's Fuseki dataset) — asserted by an integration test.
- [ ] A real (non-stub) LLM adapter is selectable and actually called when configured.
- [ ] An **eval harness** compares grounded-vs-ungrounded answers on a ≥20-item golden set; results recorded.
- [ ] `run_result` contains provenance (which triples/products were read), traced.

### W2 — Authentication + authorization + tenant enforcement  ·  **Priority 2**
*Goal:* identity on every request; per-application authorization; `created_by` becomes trustworthy.
*Why second (co-critical):* auth's absence silently nullifies **tenant isolation** and **audit integrity**; it's also no longer tracked. Unblocks any non-local deployment.
*Routing:* **Q1 = Yes** (authz rules are testable). **Q2 = Yes** (security-critical; retrofit touches every endpoint) → **contract table (who-can-do-what) + acceptance tests + staged rollout + human security review.**
*Acceptance:*
- [ ] A who-can-do-what matrix exists (contract table) and is enforced by middleware.
- [ ] Cross-tenant access test: caller for app A **cannot** read/write app B (returns 403) — asserted.
- [ ] Trace/audit records carry an authenticated actor (closes TD-023).

### W3 — Un-tracked blind-spot remediation  ·  **Priority 3**
*Goal:* close TD-022/023/024/025 (secrets-at-rest, actor identity, optimistic locking, logging).
*Routing:* **Q1 = Yes** (each testable). **Q2 = mixed** — secrets & locking are data-integrity/security (careful, reversible-by-design); logging is low-risk.
*Acceptance:*
- [ ] Connector credentials encrypted at rest; contract §4 corrected (closes TD-022/TD-027 doc-fix).
- [ ] Optimistic-locking invariant (version/ETag guard) on aggregate updates; concurrent-write test proves last-write is rejected (closes TD-024).
- [ ] Structured request logging present (closes TD-025).

### W4 — Physical adapters (make the skeleton a system)  ·  **Priority 4**
*Goal:* KG population (A-Box loader: rows→triples), then vectors (Qdrant embed/search).
*Routing:* **Q1 = Yes** for mechanics (triples land, vectors return), **NO** for graph *quality* (needs evals). **Q2 = No.**
*Acceptance:*
- [ ] A-Box loader writes instance triples into the app's Fuseki dataset; `triple_count` reflects reality (>0), SPARQL returns instances.
- [ ] Vector upsert + similarity search execute against a real Qdrant collection.

**Build order:** W1 → W2 → W3 → W4. (W1 proves the premise; W2 makes it safely usable; W3 removes silent risk; W4 scales the runtime.)

---

## 7. Operating proposal — keep this document *true* (the STA discipline)

A snapshot in a process that doesn't maintain truth rots (see: the MVP checklist, TD-007). The minimum operating change:

1. **Reality-first per work item.** Before speccing a change, read the current code state and record it — the same move that produced §3–§4. No spec ships that hasn't been reconciled against the code.
2. **One current spec, kept honest.** Retire the reliance on frozen `.docx` + scattered per-module tables as the source of truth; this reconciliation doc is the single living view. Each sprint close updates §3–§5 (a Definition-of-Done gate), replacing the backward-only health-report ritual.
3. **Acceptance-before-build.** Every workstream lands with machine-checkable acceptance criteria (as in §6) *before* code — and, where **Q1 = No** (quality/AI questions), an **eval** rather than a pretend unit test.
4. **Contract↔code reconciliation gate.** A contract change and its code must land together; a CI/review check flags any lifecycle/state a contract claims that the code's transition tables don't implement (would have caught TD-027 automatically).

This is a **redirect** of SIP's existing ceremony, not a second layer on top: keep the contracts and decision registers; add reconciliation + acceptance-gating; drop the redundant backward-only reporting.

---

## 8. Adoption & maintenance acceptance

- [ ] PO / Lead Architect review §4 (reconciliation) and §5 (proposed TDs); accept or reject each proposed TD.
- [ ] §3–§5 updated at each sprint close (owner: Tech Lead).
- [ ] Reconciliation gate (§7.4) added to the PR architecture checks.
- [ ] W1 eval harness result recorded before any "semantic layer works" claim is made externally.

---

## 9. References

- Build-state evidence: three independent code+doc audits, 2026-07-08 (agent-runtime, LLM, connectors, vectors, storage, products, security, decisions).
- Decision registers: frozen `architecture/*.docx` (D/R/DM/API); TD rows in `docs/governance/health-reports/Sprint_N_architecture_health.md`.
- ARR-001/002/004: [SIP_Architecture_Review_Resolution_v1.md](../architecture/SIP_Architecture_Review_Resolution_v1.md).

---

*Independent reconciliation artifact produced with the STA reality-first method. Draft for SIP PO / Lead Architect review — not official SIP documentation until signed.*
