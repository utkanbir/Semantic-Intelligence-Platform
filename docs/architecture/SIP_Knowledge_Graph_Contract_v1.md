# Knowledge Graph Registry Contract v1

**Status:** Authoritative supplement (Sprint 7)  
**Date:** 2026-06-29  
**Issue:** S7-07 (#119)  
**Architecture references:** ARR-002, ARR-003, ARR-004, R-009, R-013, API-003, D-011  
**Companion:** [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md)

---

## 1. Purpose

Define the **KnowledgeGraphRegistry lifecycle contract** that the `knowledge_graph` module must implement before Sprint 7 **gate = Yes** Knowledge Graph PRs merge to `develop`.

This document is binding for:

- `KnowledgeGraphRegistry` aggregate shape (DM addendum — Sprint 7)
- Lifecycle states per Asset Catalog (ARR-002) for Knowledge Graph assets
- Minimum REST API surface for Sprint 7 issues S7-08–S7-10
- Logical linkage to Application workspace `fuseki_dataset` (ARR-001) without physical triple provisioning

Backend implements against this contract; no alternate status enum.

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| KnowledgeGraphRegistry fields | Fuseki adapter execution (`adapters` sprint) |
| Status enum and transition matrix (S7-09) | Platform Console KG Explorer UI |
| `/api/v1/knowledge-graphs` CRUD and status endpoints | SPARQL query execution |
| Optional ontology binding (published/versioned) | Full graph diff / impact analysis |
| SemanticTransaction on create (S7-10) | `KnowledgeGraphRefreshed` event emission (deferred) |

---

## 3. Aggregate relationship

```
Application (DM-001)
└── KnowledgeGraphRegistry — 1:N at MVP
    ├── graph_metadata (JSON)
    └── bound_ontology_ids (logical references to OntologyDefinition rows)

ApplicationWorkspace (DM-002)
└── fuseki_dataset — logical store target (not mutated by this module)

OntologyDefinition (ontology module)
└── referenced by bound_ontology_ids when non-empty (0:N at MVP)
```

- `KnowledgeGraphRegistry.application_id` is required; FK to `applications.id`.
- Creating a registry row **does not** insert RDF triples or mutate `fuseki_dataset` (ARR-004).

---

## 4. KnowledgeGraphRegistry aggregate

### 4.1 Required fields

| Field | Type (logical) | Required | Notes |
|-------|----------------|----------|-------|
| `id` | UUID | yes | Primary key |
| `application_id` | UUID | yes | FK to Application |
| `status` | enum | yes | See §5 |
| `title` | string | yes | Human-readable graph name |
| `description` | text | no | Summary |
| `created_by` | string | yes | Actor identifier (MVP opaque string) |
| `created_at` | datetime | yes | Row creation timestamp |
| `updated_at` | datetime | yes | Last mutation timestamp |
| `populated_at` | datetime | no | Set when status → Populated |
| `graph_updated_at` | datetime | no | Set when status → Updated |
| `archived_at` | datetime | no | Set when status → Archived |
| `graph_metadata` | JSON | yes | Graph summary metadata; see §4.2 |
| `bound_ontology_ids` | JSON array | yes | UUID strings; may be `[]` at create |

### 4.2 graph_metadata (MVP stub)

```json
{
  "schema_version": "1",
  "triple_count": 0,
  "namespaces": [],
  "metadata": {}
}
```

### 4.3 Ontology binding eligibility

| OntologyDefinition status | Bindable? |
|---------------------------|-----------|
| `Draft`, `Validated`, `Approved` | **No** |
| `Published`, `Versioned` | **Yes** |
| `Retired` | **No** |

Validated on create, update (while mutable), and when entering `Populated`.

---

## 5. Lifecycle status (ARR-002)

| Value | Meaning |
|-------|---------|
| `Created` | Registry row exists; no population yet |
| `Populated` | Graph metadata reflects initial population |
| `Updated` | Graph refreshed / metadata updated |
| `Archived` | Historical; not active |

### 5.1 Transition matrix (MVP)

| From | Allowed targets |
|------|-----------------|
| `Created` | `Populated` |
| `Populated` | `Updated`, `Archived` |
| `Updated` | `Archived` |
| `Archived` | *(none — terminal)* |

- Invalid transitions return **422**.
- Timestamps set on first entry to `Populated`, `Updated`, `Archived`.

---

## 6. ARR-004 alignment

Creating a KnowledgeGraphRegistry **must not** provision Fuseki datasets or insert triples. Rows are governed metadata; materialization is deferred to `adapters`.

---

## 7. API and service expectations (Sprint 7)

| Layer | Responsibility |
|-------|----------------|
| `knowledge_graph/api` | REST under `/api/v1/knowledge-graphs` |
| `knowledge_graph/services` | Lifecycle, ontology binding validation |
| `knowledge_graph/repositories` | Persist KnowledgeGraphRegistry rows |
| `knowledge_graph/ports` | `TraceRecorder`; `PublishedOntologyReader` |

### 7.1 CRUD (S7-09)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/knowledge-graphs` | Create; status `Created` |
| `GET` | `/api/v1/knowledge-graphs` | List; filter by `application_id`; optional `status` |
| `GET` | `/api/v1/knowledge-graphs/{id}` | Get by id |
| `PATCH` | `/api/v1/knowledge-graphs/{id}` | Update title, description, metadata, bindings (if mutable) |

### 7.2 Status transitions (S7-09)

| Method | Path | Behavior |
|--------|------|----------|
| `PATCH` | `/api/v1/knowledge-graphs/{id}/status` | Body `{ "status": "..." }` per §5.1 |

### 7.3 Trace (R-013, S7-10)

| Field | Value |
|-------|-------|
| `transaction_type` | `knowledge_graph.created` |
| `resource_type` | `KnowledgeGraphRegistry` |
| `resource_id` | registry UUID |

---

## 8. Sprint 7 issue mapping

| Issue | Deliverable |
|-------|-------------|
| S7-07 | This contract (gate = No) |
| S7-08 | Domain models + migration |
| S7-09 | CRUD + status API |
| S7-10 | SemanticTransaction on create |

---

## 9. Acceptance criteria (architect review)

- [ ] KnowledgeGraphRegistry fields complete
- [ ] ARR-002 status enum and transition matrix (§5)
- [ ] Ontology binding rules (§4.3)
- [ ] API paths for S7-08–S7-10 (§7)
- [ ] ARR-004 no runtime assets at create

---

## 10. References

- SIP Asset Catalog v1 — Knowledge Graph lifecycle
- [SIP_Ontology_Definition_Contract_v1.md](./SIP_Ontology_Definition_Contract_v1.md)
- [SIP_ApplicationWorkspace_Provisioning_Contract_v1.md](./SIP_ApplicationWorkspace_Provisioning_Contract_v1.md) — `fuseki_dataset`
