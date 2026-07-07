import type { ChangeEvent } from "react";
import {
  createRowId,
  type OntologyClassRow,
  type OntologyDataPropertyRow,
  type OntologyObjectPropertyRow,
} from "../lib/ontologyDraft";

const XSD_DATATYPE_OPTIONS = [
  "string",
  "boolean",
  "integer",
  "long",
  "decimal",
  "float",
  "double",
  "date",
  "dateTime",
] as const;

interface ManualOntologyDraftEditorProps {
  classes: OntologyClassRow[];
  objectProperties: OntologyObjectPropertyRow[];
  dataProperties: OntologyDataPropertyRow[];
  classNameOptions: string[];
  onClassesChange: (rows: OntologyClassRow[]) => void;
  onObjectPropertiesChange: (rows: OntologyObjectPropertyRow[]) => void;
  onDataPropertiesChange: (rows: OntologyDataPropertyRow[]) => void;
  onDraftChange?: () => void;
}

function updateRows<T extends { id: string }>(
  rows: T[],
  rowId: string,
  field: keyof T,
  value: string,
): T[] {
  return rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row));
}

export function ManualOntologyDraftEditor({
  classes,
  objectProperties,
  dataProperties,
  classNameOptions,
  onClassesChange,
  onObjectPropertiesChange,
  onDataPropertiesChange,
  onDraftChange,
}: ManualOntologyDraftEditorProps) {
  function notifyDraftChange() {
    onDraftChange?.();
  }

  function handleClassFieldChange(
    rowId: string,
    field: keyof OntologyClassRow,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    onClassesChange(updateRows(classes, rowId, field, event.target.value));
    notifyDraftChange();
  }

  function handleObjectPropertyFieldChange(
    rowId: string,
    field: keyof OntologyObjectPropertyRow,
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    onObjectPropertiesChange(updateRows(objectProperties, rowId, field, event.target.value));
    notifyDraftChange();
  }

  function handleDataPropertyFieldChange(
    rowId: string,
    field: keyof OntologyDataPropertyRow,
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    onDataPropertiesChange(updateRows(dataProperties, rowId, field, event.target.value));
    notifyDraftChange();
  }

  return (
    <div className="ontology-wizard__manual-tables">
      <section aria-labelledby="manual-classes-heading">
        <div className="ontology-wizard__manual-table-header">
          <h4 id="manual-classes-heading">Classes</h4>
          <button
            type="button"
            className="platform-page__button"
            onClick={() => {
              onClassesChange([
                ...classes,
                { id: createRowId(), label: "", description: "" },
              ]);
              notifyDraftChange();
            }}
          >
            Add class
          </button>
        </div>
        <div className="platform-page__table-wrap">
          <table className="platform-table ontology-wizard__manual-table">
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Description</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={3} className="ontology-wizard__manual-empty">
                    No classes yet. Add at least one class to define object and data property
                    domains.
                  </td>
                </tr>
              ) : (
                classes.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        aria-label="Class label"
                        value={row.label}
                        onChange={(event) => handleClassFieldChange(row.id, "label", event)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label="Class description"
                        value={row.description}
                        onChange={(event) => handleClassFieldChange(row.id, "description", event)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="platform-page__button platform-table__action"
                        onClick={() => {
                          onClassesChange(classes.filter((item) => item.id !== row.id));
                          notifyDraftChange();
                        }}
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

      <section aria-labelledby="manual-object-properties-heading">
        <div className="ontology-wizard__manual-table-header">
          <h4 id="manual-object-properties-heading">Object properties</h4>
          <button
            type="button"
            className="platform-page__button"
            onClick={() => {
              onObjectPropertiesChange([
                ...objectProperties,
                {
                  id: createRowId(),
                  label: "",
                  description: "",
                  domain: classNameOptions[0] ?? "",
                  range: classNameOptions[0] ?? "",
                },
              ]);
              notifyDraftChange();
            }}
            disabled={classNameOptions.length === 0}
          >
            Add object property
          </button>
        </div>
        <div className="platform-page__table-wrap">
          <table className="platform-table ontology-wizard__manual-table">
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Domain</th>
                <th scope="col">Range</th>
                <th scope="col">Description</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {objectProperties.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ontology-wizard__manual-empty">
                    No object properties yet.
                  </td>
                </tr>
              ) : (
                objectProperties.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        aria-label="Object property label"
                        value={row.label}
                        onChange={(event) =>
                          handleObjectPropertyFieldChange(row.id, "label", event)
                        }
                      />
                    </td>
                    <td>
                      <select
                        aria-label="Object property domain"
                        value={row.domain}
                        onChange={(event) =>
                          handleObjectPropertyFieldChange(row.id, "domain", event)
                        }
                      >
                        {classNameOptions.map((className) => (
                          <option key={className} value={className}>
                            {className}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label="Object property range"
                        value={row.range}
                        onChange={(event) =>
                          handleObjectPropertyFieldChange(row.id, "range", event)
                        }
                      >
                        {classNameOptions.map((className) => (
                          <option key={className} value={className}>
                            {className}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label="Object property description"
                        value={row.description}
                        onChange={(event) =>
                          handleObjectPropertyFieldChange(row.id, "description", event)
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="platform-page__button platform-table__action"
                        onClick={() => {
                          onObjectPropertiesChange(
                            objectProperties.filter((item) => item.id !== row.id),
                          );
                          notifyDraftChange();
                        }}
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

      <section aria-labelledby="manual-data-properties-heading">
        <div className="ontology-wizard__manual-table-header">
          <h4 id="manual-data-properties-heading">Data properties</h4>
          <button
            type="button"
            className="platform-page__button"
            onClick={() => {
              onDataPropertiesChange([
                ...dataProperties,
                {
                  id: createRowId(),
                  label: "",
                  description: "",
                  domain: classNameOptions[0] ?? "",
                  datatype: "string",
                },
              ]);
              notifyDraftChange();
            }}
            disabled={classNameOptions.length === 0}
          >
            Add data property
          </button>
        </div>
        <div className="platform-page__table-wrap">
          <table className="platform-table ontology-wizard__manual-table">
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Domain</th>
                <th scope="col">Datatype</th>
                <th scope="col">Description</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dataProperties.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ontology-wizard__manual-empty">
                    No data properties yet.
                  </td>
                </tr>
              ) : (
                dataProperties.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        aria-label="Data property label"
                        value={row.label}
                        onChange={(event) => handleDataPropertyFieldChange(row.id, "label", event)}
                      />
                    </td>
                    <td>
                      <select
                        aria-label="Data property domain"
                        value={row.domain}
                        onChange={(event) => handleDataPropertyFieldChange(row.id, "domain", event)}
                      >
                        {classNameOptions.map((className) => (
                          <option key={className} value={className}>
                            {className}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label="Data property datatype"
                        value={row.datatype}
                        onChange={(event) =>
                          handleDataPropertyFieldChange(row.id, "datatype", event)
                        }
                      >
                        {XSD_DATATYPE_OPTIONS.map((datatype) => (
                          <option key={datatype} value={datatype}>
                            {datatype}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label="Data property description"
                        value={row.description}
                        onChange={(event) =>
                          handleDataPropertyFieldChange(row.id, "description", event)
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="platform-page__button platform-table__action"
                        onClick={() => {
                          onDataPropertiesChange(
                            dataProperties.filter((item) => item.id !== row.id),
                          );
                          notifyDraftChange();
                        }}
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
  );
}
