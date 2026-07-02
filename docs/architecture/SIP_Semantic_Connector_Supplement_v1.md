# TD-006 — SemanticConnector and Ontology Transaction Orchestration (Sprint 27)

## Decision

Platform **Connectors** unify infrastructure endpoints and semantic roles under one UI concept.

| Layer | Backend aggregate (unchanged API) | UI section |
|-------|-----------------------------------|------------|
| Infrastructure | `TechnologyAdapter` (`/adapters`) | Infrastructure connectors — postgresql, minio, fuseki, … |
| Semantic role | `SemanticConnector` (`/semantic-connectors`) | Semantic connectors — ontology_store, knowledge_graph_store |

Ontology create/import/status/fork operations record **SemanticTransaction** rows with `application_id` and ordered **TraceSteps**.

Ontology create/import/status/fork operations record **SemanticTransaction** rows with `application_id` and ordered **TraceSteps**.

## API surface

- `POST/GET /api/v1/semantic-connectors`
- `POST /api/v1/ontologies/import`
- `GET /api/v1/audit-traces?application_id=` (+ optional `resource_type`, `transaction_type_prefix`)

## Deferred

- Real ObjectStorage/Fuseki artifact write (stub URI only)
- LLM document extraction
- OpenMetadata sync

## Gate

Architecture gate **Yes** — approved for Sprint 27 MVP scope above.
