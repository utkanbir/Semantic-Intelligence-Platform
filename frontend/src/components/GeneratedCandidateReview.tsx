import type { ChangeEvent } from "react";
import type { CandidateEvidence } from "../api/ontologies";
import { createRowId } from "../lib/ontologyDraft";
import {
  countCandidates,
  type GeneratedClassRow,
  type GeneratedDraftRows,
  type GeneratedPropertyRow,
  type GeneratedRelationshipRow,
} from "../lib/ontologyExtraction";

interface GeneratedCandidateReviewProps {
  rows: GeneratedDraftRows;
  onRowsChange: (rows: GeneratedDraftRows) => void;
  approved: boolean;
  onApprovedChange: (approved: boolean) => void;
  extractionAvailable: boolean;
  summary?: string | null;
  model?: string | null;
}

function updateRows<T extends { id: string }>(
  rows: T[],
  rowId: string,
  field: keyof T,
  value: string,
): T[] {
  return rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row));
}

function EvidenceCell({ evidence }: { evidence: CandidateEvidence[] }) {
  if (evidence.length === 0) {
    return <span className="ontology-wizard__evidence-empty">No evidence provided</span>;
  }

  return (
    <ul className="ontology-wizard__evidence-list" aria-label="Source evidence">
      {evidence.map((item, index) => (
        <li key={`${item.snippet}-${index}`} className="ontology-wizard__evidence-item">
          <span className="ontology-wizard__evidence-snippet">“{item.snippet}”</span>
          {item.source_ref && (
            <span className="ontology-wizard__evidence-source"> — {item.source_ref}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function GeneratedCandidateReview({
  rows,
  onRowsChange,
  approved,
  onApprovedChange,
  extractionAvailable,
  summary,
  model,
}: GeneratedCandidateReviewProps) {
  const totalCandidates = countCandidates(rows);

  function handleClassChange(
    rowId: string,
    field: keyof GeneratedClassRow,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    onRowsChange({ ...rows, classes: updateRows(rows.classes, rowId, field, event.target.value) });
  }

  function handlePropertyChange(
    rowId: string,
    field: keyof GeneratedPropertyRow,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    onRowsChange({
      ...rows,
      properties: updateRows(rows.properties, rowId, field, event.target.value),
    });
  }

  function handleRelationshipChange(
    rowId: string,
    field: keyof GeneratedRelationshipRow,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    onRowsChange({
      ...rows,
      relationships: updateRows(rows.relationships, rowId, field, event.target.value),
    });
  }

  const isStubSample =
    extractionAvailable && (model == null || model === "" || /stub/i.test(model));

  return (
    <div className="ontology-wizard__candidate-review">
      {isStubSample && (
        <div className="ontology-wizard__parse-warnings" role="status">
          <h5>Sample / stub output</h5>
          <p className="ontology-wizard__hint">
            Candidates below are produced by the deterministic stub adapter, not a live LLM.
            Treat them as illustrative placeholders until a real provider is configured.
          </p>
        </div>
      )}
      {model && !isStubSample && (
        <p className="ontology-wizard__file-info" role="status">
          Extracted with model: {model}
        </p>
      )}
      {summary && <p className="ontology-wizard__hint">{summary}</p>}

      {!extractionAvailable && (
        <div className="ontology-wizard__parse-warnings" role="status">
          <h5>Extraction unavailable</h5>
          <p className="ontology-wizard__hint">
            The extraction model was unavailable, so no candidates were suggested. An empty
            editable draft was still created — add concepts manually below, then approve to
            continue.
          </p>
        </div>
      )}

      {extractionAvailable && totalCandidates === 0 && (
        <p className="ontology-wizard__manual-empty" role="status">
          Extraction returned no candidates. Add concepts manually below, then approve to continue.
        </p>
      )}

      <div className="ontology-wizard__manual-tables">
        <section aria-labelledby="generated-classes-heading">
          <div className="ontology-wizard__manual-table-header">
            <h4 id="generated-classes-heading">Candidate classes</h4>
            <button
              type="button"
              className="platform-page__button"
              onClick={() =>
                onRowsChange({
                  ...rows,
                  classes: [
                    ...rows.classes,
                    {
                      id: createRowId(),
                      name: "",
                      label: "",
                      description: "",
                      evidence: [],
                    },
                  ],
                })
              }
            >
              Add class
            </button>
          </div>
          <div className="platform-page__table-wrap">
            <table className="platform-table ontology-wizard__manual-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Label</th>
                  <th scope="col">Description</th>
                  <th scope="col">Evidence</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.classes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="ontology-wizard__manual-empty">
                      No candidate classes.
                    </td>
                  </tr>
                ) : (
                  rows.classes.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          aria-label="Candidate class name"
                          value={row.name}
                          onChange={(event) => handleClassChange(row.id, "name", event)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label="Candidate class label"
                          value={row.label}
                          onChange={(event) => handleClassChange(row.id, "label", event)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label="Candidate class description"
                          value={row.description}
                          onChange={(event) => handleClassChange(row.id, "description", event)}
                        />
                      </td>
                      <td>
                        <EvidenceCell evidence={row.evidence} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="platform-page__button platform-table__action"
                          onClick={() =>
                            onRowsChange({
                              ...rows,
                              classes: rows.classes.filter((item) => item.id !== row.id),
                            })
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="generated-relationships-heading">
          <div className="ontology-wizard__manual-table-header">
            <h4 id="generated-relationships-heading">Candidate relationships</h4>
            <button
              type="button"
              className="platform-page__button"
              onClick={() =>
                onRowsChange({
                  ...rows,
                  relationships: [
                    ...rows.relationships,
                    {
                      id: createRowId(),
                      name: "",
                      label: "",
                      domain: "",
                      range: "",
                      description: "",
                      evidence: [],
                    },
                  ],
                })
              }
            >
              Add relationship
            </button>
          </div>
          <div className="platform-page__table-wrap">
            <table className="platform-table ontology-wizard__manual-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Domain</th>
                  <th scope="col">Range</th>
                  <th scope="col">Description</th>
                  <th scope="col">Evidence</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.relationships.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="ontology-wizard__manual-empty">
                      No candidate relationships.
                    </td>
                  </tr>
                ) : (
                  rows.relationships.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          aria-label="Candidate relationship name"
                          value={row.name}
                          onChange={(event) => handleRelationshipChange(row.id, "name", event)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label="Candidate relationship domain"
                          value={row.domain}
                          onChange={(event) => handleRelationshipChange(row.id, "domain", event)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label="Candidate relationship range"
                          value={row.range}
                          onChange={(event) => handleRelationshipChange(row.id, "range", event)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label="Candidate relationship description"
                          value={row.description}
                          onChange={(event) =>
                            handleRelationshipChange(row.id, "description", event)
                          }
                        />
                      </td>
                      <td>
                        <EvidenceCell evidence={row.evidence} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="platform-page__button platform-table__action"
                          onClick={() =>
                            onRowsChange({
                              ...rows,
                              relationships: rows.relationships.filter(
                                (item) => item.id !== row.id,
                              ),
                            })
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="generated-properties-heading">
          <div className="ontology-wizard__manual-table-header">
            <h4 id="generated-properties-heading">Candidate data properties</h4>
            <button
              type="button"
              className="platform-page__button"
              onClick={() =>
                onRowsChange({
                  ...rows,
                  properties: [
                    ...rows.properties,
                    {
                      id: createRowId(),
                      name: "",
                      label: "",
                      domain: "",
                      datatype: "",
                      description: "",
                      evidence: [],
                    },
                  ],
                })
              }
            >
              Add data property
            </button>
          </div>
          <div className="platform-page__table-wrap">
            <table className="platform-table ontology-wizard__manual-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Domain</th>
                  <th scope="col">Datatype</th>
                  <th scope="col">Description</th>
                  <th scope="col">Evidence</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.properties.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="ontology-wizard__manual-empty">
                      No candidate data properties.
                    </td>
                  </tr>
                ) : (
                  rows.properties.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          aria-label="Candidate property name"
                          value={row.name}
                          onChange={(event) => handlePropertyChange(row.id, "name", event)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label="Candidate property domain"
                          value={row.domain}
                          onChange={(event) => handlePropertyChange(row.id, "domain", event)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label="Candidate property datatype"
                          value={row.datatype}
                          onChange={(event) => handlePropertyChange(row.id, "datatype", event)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label="Candidate property description"
                          value={row.description}
                          onChange={(event) => handlePropertyChange(row.id, "description", event)}
                        />
                      </td>
                      <td>
                        <EvidenceCell evidence={row.evidence} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="platform-page__button platform-table__action"
                          onClick={() =>
                            onRowsChange({
                              ...rows,
                              properties: rows.properties.filter((item) => item.id !== row.id),
                            })
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <label className="ontology-wizard__approval">
        <input
          type="checkbox"
          checked={approved}
          onChange={(event) => onApprovedChange(event.target.checked)}
        />
        <span>I approve this generated draft to become the editable ontology draft</span>
      </label>
    </div>
  );
}
