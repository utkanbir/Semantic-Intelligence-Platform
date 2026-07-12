# ADR-005: Extended Connector Layer Model (Six Layers, Invoke, MCP Allowlist)

**Status:** Accepted  
**Date:** 2026-07-12  
**Accepted:** 2026-07-12 (PO)  
**Deciders:** Lead Architect, PO  
**Depends on:** ADR-003 (Accepted — Sandbox layer config), ADR-001 (K8s Oluştur provisioning)

---

## Context

Frozen MVP adapters module exposes ports for:

- ObjectStorage, RelationalDB, KnowledgeGraph, VectorStore, LLM

Discovery connectors (Sprint 37) cover **Kademe 1** metadata extraction (JDBC, REST, CSV, OWL file) with human approval before ontology materialization.

The v2 model defines a **six-layer connector matrix** per Sandbox (§9.1):

| Layer | Target | Read | Create/Write |
|-------|--------|------|--------------|
| Ontology | Customer Graph DB | Yes | Yes (governed wizard) |
| Knowledge Graph | Customer Graph DB | Yes | Yes (curated facts) |
| Business Glossary + Data Catalog | Governance tool (Informatica, OpenMetadata) | Yes | **No** (by design) |
| Vector Store | Customer vector DB | Yes | Yes (embeddings) |
| Semantic Layer | dbt SL, Cube, etc. | Yes + **Invoke** | No (infra only in Oluştur) |
| Database | Customer DB | Yes | **No** |

Additional mechanisms:

- **Bağlan vs Oluştur** acquisition mode (§9.2)
- **Native adapter vs MCP** as interchangeable implementations behind same port (§9.3)
- **Invoke** — third capability beyond Read/Create (e.g. DQ score, metric query)
- **MCP allowlist** — not all MCP tools exposed to routing
- **Discover Connector Kademe 2** — LLM-assisted config proposal; **Kademe 3 rejected** (autonomous live connector code)

Current MVP has no Glossary, Catalog, or Semantic Layer ports. TraceLayer has no Information/Data layers (ADR-002).

---

## Decision

### 1. Port taxonomy extension

Extend `app/shared/ports/` (and adapters module) with:

| Port | Purpose |
|------|---------|
| `BusinessGlossaryPort` | Read terms, definitions, stewards |
| `DataCatalogPort` | Read datasets, columns, lineage metadata |
| `SemanticLayerPort` | Read metrics/dimensions; **Invoke** named metric queries |

Existing ports unchanged: `KnowledgeGraphPort`, `RelationalDBPort`, `VectorStorePort`, `LLMPort`.

Each port exposes a **fixed method surface** to the router (ADR-004). Implementation may be:

- Native REST/SDK adapter (e.g. OpenMetadata)
- Generic MCP client adapter bound to vendor MCP server

Routing **must not** branch on implementation type.

### 2. Capability matrix enforcement

Enforce at adapter registration and router invocation:

| Layer | Create/Write | Invoke |
|-------|--------------|--------|
| Ontology | Allowed (governed) | No |
| Knowledge Graph | Allowed (curated) | No |
| Glossary / Catalog | **Denied** | No |
| Vector Store | Allowed (embeddings) | No |
| Semantic Layer | **Denied** | **Allowed** (allowlisted operations only) |
| Database | **Denied** | No (SELECT via RelationalDB read API only) |

Violations fail closed at service layer — not runtime discovery.

### 3. MCP allowlist policy

When connector uses MCP:

- Platform maintains per-vendor **tool allowlist** in configuration (Sandbox or platform admin)
- Destructive or write tools (e.g. "delete term", "create table") are **never** allowlisted
- Aligns with v2 §9.3 and Database read-only principle

MCP remains **internal adapter mechanism** — not external MCP API (API-001 unchanged).

### 4. Discover Connector governance

| Kademe | Status | Behavior |
|--------|--------|----------|
| 1 | **Supported** (MVP+) | Metadata extraction, human approval — current Discovery |
| 2 | **Supported** (post-MVP) | LLM proposes connector config; human approves before activation |
| 3 | **Explicitly rejected** | Autonomous connector code generation and live deployment without review |

Kademe 3 conflicts with §9.4 deterministic router and §9.3 creation boundary — **out of scope** until separate governance review.

### 5. Oluştur mode provisioning

When Sandbox layer uses **Oluştur**:

- Platform provisions **dedicated** instance per Sandbox (§9.2 isolation)
- Requires DevOps operators/controllers (Sprint 51–53)
- Provisioning creates **empty** technology shell — no glossary terms, metrics, or domain data

Bağlan mode: credentials + endpoint only.

---

## Constraints

- ARR-003 module naming: new adapters live under `adapters/` implementations; domain modules do not import vendor SDKs
- D-007: connector config is infrastructure metadata, not ontology content
- Application deprecation follows ADR-003 §5 — connector config is Sandbox-scoped; legacy Application APIs unchanged during transition
- Assessment MVP E2E may continue with subset (Ontology + optional KG) until full matrix lands

---

## Consequences

### Positive

- Router can assemble v2 context bundle (§10) with explicit layer contracts
- Vendor flexibility via MCP without router changes

### Negative

- Large adapter surface area (Informatica, OpenMetadata, Cube, dbt SL, etc.)
- Allowlist maintenance burden per MCP server version

### Extension vs conflict with MVP

| Item | Verdict |
|------|---------|
| Six layers | **Extends** MVP port model |
| Glossary/Catalog read-only | **Extends** — no conflict with ARR-004 |
| Invoke on Semantic Layer | **New** capability — requires port interface ADR (this ADR) |
| Kademe 3 Discover | **Conflicts** with platform principles — rejected |
| MCP as internal adapter | **Compatible** with API-001 (MCP external-only for agents) |

---

## Alternatives considered

**A. Single "GovernancePort" for Glossary+Catalog** — Rejected for v2 trace granularity (Information layer steps need distinct attribution).

**B. Expose all MCP tools dynamically** — Rejected (§9.3 allowlist).

---

## References

- v2 §9.1–§9.5, §13.1
- `SIP_User_Stories_Backlog (4).docx` Epic 1 (US-1.1–1.4), Epic 10 (US-10.1)
- `docs/project/Sprint_39_Plus_Roadmap.md` Sprint 51–53
