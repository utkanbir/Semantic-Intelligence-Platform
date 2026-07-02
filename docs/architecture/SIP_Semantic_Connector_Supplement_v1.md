# TD-006 — SemanticConnector and Ontology Transaction Orchestration (Sprint 27)

## Decision

Introduce **SemanticConnector** as a platform-level aggregate distinct from **TechnologyAdapter**.

| Aggregate | Role |
|-----------|------|
| TechnologyAdapter | Infrastructure endpoint (MinIO, Fuseki, PostgreSQL, …) |
| SemanticConnector | Semantic role binding (`ontology_store`, `knowledge_graph_store`) to an Active adapter |

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
