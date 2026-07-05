# Semantic Transaction Realignment Gap Note

**Date:** 2026-07-04  
**Prepared by:** PMO (DM hat)  
**Purpose:** Sprint 32 epic / issue input for Semantic Transaction realignment

---

## 1. Problem statement

Current Console behavior and Sprint 30/31 documentation use **Semantic Transactions** language for a surface that is still backed by the generic `audit_trace` query model.

This creates a concept drift:

- `Semantic Transaction` should mean **semantic lineage / meaning evolution**
- `Audit trace` should remain the broader **technical / operational read surface**
- Connector or platform operations may create trace records, but they are not automatically valid **semantic journey** records for end-user presentation

The result is that operational events such as connector registration or provision flows can appear in a UI labeled as **Semantic Transactions**.

---

## 2. Concept source of truth

Per `Semantic Transaction Concept`:

- Technical logs explain **how software executed**
- Semantic Transactions explain **how meaning evolved**
- A Semantic Transaction is the semantic lineage of a business question, semantic asset, or AI reasoning process
- Not every request traverses every semantic layer; the Semantic Transaction records the semantic path actually taken
- Connectors and Semantic Assets are related but separate concepts

Therefore:

- `connector.created`
- `adapter.registered`
- `connector.provisioned`

must not be treated as user-facing semantic lineage entries by default unless they are explicitly part of a semantic asset journey being explained.

---

## 3. Current implementation gap

### Frontend

- `frontend/src/App.tsx` maps `/semantic-transactions` to `/audit-trace`
- `frontend/src/components/PlatformShell.tsx` labels `/audit-trace` as `Semantic Transactions`
- `frontend/src/pages/platform/AuditTracePage.tsx` calls `listAuditTraces()` and presents the results as Semantic Transactions
- The current ontology-first mode is only a heuristic:
  - `resource_type = OntologyDefinition`
  - `transaction_type_prefix = ontology`

When the ontology-only toggle is disabled, the page falls back to the broader audit feed.

### Backend

- `backend/app/modules/audit_trace/api/routes.py` exposes `GET /api/v1/audit-traces`
- `backend/app/modules/audit_trace/repositories/sqlalchemy_repository.py` filters only by:
  - `resource_id`
  - `application_id`
  - `resource_type`
  - `transaction_type_prefix`
  - `limit`
- There is no first-class domain classification such as:
  - `semantic_lineage`
  - `operational_audit`
  - `platform_provisioning`

### Documentation drift

Sprint 30 and Sprint 31 closeout docs overstate the current implementation by describing the `audit_trace` explorer as a broader **Semantic Transactions** feed.

---

## 4. Why this matters

If left unchanged:

- product terminology loses trust
- users see connector / platform operations in a semantic lineage feed
- future modules can pollute the semantic surface without any explicit product decision
- backend filtering remains name/prefix-based instead of domain-based

This is not a deployment problem. It is a **domain semantics and UX contract** problem.

---

## 5. Recommended Sprint 32 direction

### Short-term containment

- Stop treating the broad `audit_trace` surface as the definitive `Semantic Transactions` product surface
- Reword Sprint 30/31 docs to reflect what actually shipped
- Make the current screen explicitly transitional if needed

### Structural fix

- Define Semantic Transaction eligibility rules
- Separate semantic lineage read concerns from operational audit concerns
- Introduce either:
  - a dedicated `semantic-transactions` read contract, or
  - explicit persisted classification on trace records
- Split Console IA between:
  - `Semantic Transactions`
  - `Audit Trace` / `Operational Trace`

---

## 6. Sprint 32 proposed work items

1. **Epic:** Semantic Transaction v2 — separate semantic lineage from audit trace surface
2. **Issue:** Domain taxonomy and eligibility contract — see [SIP_Semantic_Transaction_Taxonomy_and_Eligibility_Contract.md](./SIP_Semantic_Transaction_Taxonomy_and_Eligibility_Contract.md)
3. **Issue:** Backend query surface realignment
4. **Issue:** Console IA / UX split
5. **Issue:** Sprint 30/31 governance-document correction
