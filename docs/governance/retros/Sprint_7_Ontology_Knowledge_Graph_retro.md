# Sprint Retrospective — Sprint 7

**Date:** 2026-06-29  
**Sprint:** Sprint 7 — Ontology & Knowledge Graph  
**Facilitator:** PMO (DM hat)

---

## 1. Committed vs delivered

| Issue | Title | Delivered | PR |
|-------|-------|-----------|-----|
| #113 | S7-01 Ontology contract | Done | #123 |
| #114–#118 | S7-02..06 Ontology module | Done | #124 |
| #119 | S7-07 KG contract | Done | #125 |
| #120–#122 | S7-08..10 Knowledge graph module | Done | #126 |
| #112 | E-09 Epic | Done | All children delivered |

**Delivery rate:** 10/10 implementation issues; epic E-09 complete.

---

## 2. What went well

- **Two modules in one sprint** — `ontology` + `knowledge_graph` with contract-first pattern.
- **Cross-module binding** — KG validates published/versioned ontologies via `PublishedOntologyReader` port.
- **164 pytest** green (+13 from Sprint 6).
- **ARR-002 lifecycles** — Ontology (6-state) and Knowledge Graph (4-state) both implemented.

---

## 3. What did not go well

- **Sprint 1 ADR backlog** still open (auth stub, trace orchestration).
- **Physical adapters** not started — Fuseki/Qdrant remain namespace-only (ARR-004).
- **Ruff SIM108** caught on first KG PR push.

---

## 4. Sprint 8 adjustments

- Begin **adapters** module (PostgreSQL, MinIO, Fuseki, Qdrant stubs) per roadmap.
- **Auth stub ADR** priority before Console.
- Pin `sip-backend:s7` image tag on cluster after merge.

---

## 9. Sprint 7 success criteria

| Criterion | Status |
|-----------|--------|
| OntologyDefinition CRUD `/api/v1/ontologies` | **Met** |
| Ontology lifecycle + version fork | **Met** |
| KnowledgeGraphRegistry CRUD `/api/v1/knowledge-graphs` | **Met** |
| KG lifecycle Created→Populated→Updated→Archived | **Met** |
| Ontology binding on KG | **Met** |
| SemanticTransaction on create (both modules) | **Met** |
| ARR-004 no runtime provisioning | **Met** |

---

## 10. End-user release notes

**Bu sprintte son kullanıcı için görünür bir değişiklik yok.**

---

## 11. Technical deliverables

### REST endpoints

| Module | Paths | PR |
|--------|-------|-----|
| ontology | `/api/v1/ontologies` CRUD, `/status`, `/versions` | #124 |
| knowledge_graph | `/api/v1/knowledge-graphs` CRUD, `/status` | #126 |

### Contracts

| Document | PR |
|----------|-----|
| `SIP_Ontology_Definition_Contract_v1.md` | #123 |
| `SIP_Knowledge_Graph_Contract_v1.md` | #125 |

### Infrastructure

| Öğe | Detay |
|-----|--------|
| Test suite | **164** pytest |
| CI | PR #123–#126 merged |

---

## 12. Database schema

### Migrations this sprint

| Revision | PR | Değişiklik |
|----------|-----|------------|
| `20260629_0011` | #124 | **`ontology_definitions`** |
| `20260629_0012` | #126 | **`knowledge_graph_registries`** |

### Cumulative schema (Sprint 7 sonu)

**Alembic head:** `20260629_0012`

**Tablolar:** prior 11 domain tables + `ontology_definitions`, `knowledge_graph_registries`

### Relations

```mermaid
erDiagram
    applications ||--o{ ontology_definitions : owns
    applications ||--o{ knowledge_graph_registries : owns
    ontology_definitions ||--o{ ontology_definitions : previous_version
    knowledge_graph_registries }o..o{ ontology_definitions : bound_ontology_ids
```

`bound_ontology_ids` — logical JSONB; validated at service layer.
