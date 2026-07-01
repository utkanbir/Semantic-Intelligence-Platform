import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  createOntology,
  getNextOntologyStatuses,
  getOntologyStatusActionLabel,
  listOntologies,
  updateOntologyStatus,
  type OntologyDefinitionResponse,
  type OntologyDefinitionStatus,
} from "../api/ontologies";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; ontologies: OntologyDefinitionResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: OntologyDefinitionResponse["status"]): string {
  return `ontologies-table__status ontologies-table__status--${status.toLowerCase()}`;
}

interface CreateFormFields {
  title: string;
  description: string;
  created_by: string;
  ontology_definition_json: string;
}

interface OntologyCreateFormProps {
  applicationId: string;
  onCreated: () => void;
  onCancel?: () => void;
}

function OntologyCreateForm({ applicationId, onCreated, onCancel }: OntologyCreateFormProps) {
  const [fields, setFields] = useState<CreateFormFields>({
    title: "",
    description: "",
    created_by: "",
    ontology_definition_json: "",
  });
  const [titleError, setTitleError] = useState<string | null>(null);
  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const trimmedTitle = fields.title.trim();
    if (!trimmedTitle) {
      setTitleError("Title is required");
      return;
    }
    setTitleError(null);

    const trimmedDefinition = fields.ontology_definition_json.trim();
    let ontologyDefinition: Record<string, unknown> = {};
    if (trimmedDefinition) {
      try {
        const parsed: unknown = JSON.parse(trimmedDefinition);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          setDefinitionError("Ontology definition must be a JSON object");
          return;
        }
        ontologyDefinition = parsed as Record<string, unknown>;
      } catch {
        setDefinitionError("Ontology definition must be valid JSON");
        return;
      }
    }
    setDefinitionError(null);

    setSubmitting(true);
    try {
      const description = fields.description.trim();
      const createdBy = fields.created_by.trim();
      await createOntology({
        application_id: applicationId,
        title: trimmedTitle,
        ontology_definition: ontologyDefinition,
        ...(description ? { description } : {}),
        ...(createdBy ? { created_by: createdBy } : {}),
      });
      onCreated();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create ontology";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="ontologies-page__form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Create ontology"
    >
      <div className="ontologies-page__field">
        <label htmlFor="ontology-title">Title</label>
        <input
          id="ontology-title"
          name="title"
          type="text"
          value={fields.title}
          onChange={(event) => {
            setFields((current) => ({ ...current, title: event.target.value }));
            if (titleError) {
              setTitleError(null);
            }
          }}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "ontology-title-error" : undefined}
        />
        {titleError && (
          <p id="ontology-title-error" className="ontologies-page__field-error" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="ontologies-page__field">
        <label htmlFor="ontology-description">
          Description <span className="ontologies-page__optional">(optional)</span>
        </label>
        <textarea
          id="ontology-description"
          name="description"
          rows={3}
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>

      <div className="ontologies-page__field">
        <label htmlFor="ontology-created-by">
          Created by <span className="ontologies-page__optional">(optional)</span>
        </label>
        <input
          id="ontology-created-by"
          name="created_by"
          type="text"
          value={fields.created_by}
          onChange={(event) =>
            setFields((current) => ({ ...current, created_by: event.target.value }))
          }
        />
      </div>

      <div className="ontologies-page__field">
        <label htmlFor="ontology-definition">
          Ontology definition <span className="ontologies-page__optional">(optional JSON)</span>
        </label>
        <textarea
          id="ontology-definition"
          name="ontology_definition"
          rows={4}
          placeholder="{}"
          value={fields.ontology_definition_json}
          onChange={(event) => {
            setFields((current) => ({
              ...current,
              ontology_definition_json: event.target.value,
            }));
            if (definitionError) {
              setDefinitionError(null);
            }
          }}
          aria-invalid={definitionError ? true : undefined}
          aria-describedby={definitionError ? "ontology-definition-error" : undefined}
        />
        {definitionError && (
          <p id="ontology-definition-error" className="ontologies-page__field-error" role="alert">
            {definitionError}
          </p>
        )}
      </div>

      {submitError && (
        <div className="ontologies-page__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="ontologies-page__form-actions">
        {onCancel && (
          <button
            type="button"
            className="ontologies-page__button ontologies-page__button--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="ontologies-page__button ontologies-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create ontology"}
        </button>
      </div>
    </form>
  );
}

interface OntologiesPageProps {
  applicationId: string;
}

export function OntologiesPage({ applicationId }: OntologiesPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingOntologyId, setPendingOntologyId] = useState<string | null>(null);

  const loadOntologies = useCallback(() => {
    setState({ kind: "loading" });

    return listOntologies(applicationId)
      .then((ontologies) => {
        setState({ kind: "success", ontologies });
        return ontologies;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load ontologies";
        setState({ kind: "error", message });
        throw error;
      });
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;

    listOntologies(applicationId)
      .then((ontologies) => {
        if (!cancelled) {
          setState({ kind: "success", ontologies });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load ontologies";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  function handleCreated() {
    setShowCreateForm(false);
    void loadOntologies();
  }

  async function handleStatusTransition(
    ontologyId: string,
    nextStatus: OntologyDefinitionStatus,
  ) {
    setActionError(null);
    setPendingOntologyId(ontologyId);
    try {
      await updateOntologyStatus(ontologyId, nextStatus);
      await loadOntologies();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update ontology status";
      setActionError(message);
    } finally {
      setPendingOntologyId(null);
    }
  }

  const isEmpty = state.kind === "success" && state.ontologies.length === 0;
  const hasOntologies = state.kind === "success" && state.ontologies.length > 0;

  return (
    <section className="ontologies-page" aria-labelledby="ontologies-heading">
      <div className="ontologies-page__header">
        <div>
          <h2 id="ontologies-heading">Ontology</h2>
          <p className="ontologies-page__lead">
            Ontology definitions describe the semantic model for this application&apos;s
            knowledge graph and data products.
          </p>
        </div>
        {hasOntologies && !showCreateForm && (
          <button
            type="button"
            className="ontologies-page__button ontologies-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New ontology
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p className="ontologies-page__status" role="status" aria-live="polite">
          Loading ontologies…
        </p>
      )}

      {state.kind === "error" && (
        <div className="ontologies-page__error" role="alert">
          {state.message}
        </div>
      )}

      {actionError && (
        <div className="ontologies-page__error ontologies-page__action-error" role="alert">
          {actionError}
        </div>
      )}

      {isEmpty && (
        <div className="ontologies-page__empty" role="status">
          <p>No ontology definitions yet.</p>
          <p className="ontologies-page__hint">
            Create your first ontology definition to get started.
          </p>
          <OntologyCreateForm applicationId={applicationId} onCreated={handleCreated} />
        </div>
      )}

      {hasOntologies && showCreateForm && (
        <div className="ontologies-page__create-panel">
          <h3 className="ontologies-page__create-title">New ontology</h3>
          <OntologyCreateForm
            applicationId={applicationId}
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {hasOntologies && (
        <div className="ontologies-page__table-wrap">
          <table className="ontologies-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Version</th>
                <th scope="col">Created at</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.ontologies.map((ontology) => (
                <tr key={ontology.id}>
                  <td>{ontology.title}</td>
                  <td>
                    <span className={statusClassName(ontology.status)}>{ontology.status}</span>
                  </td>
                  <td>{ontology.version_number}</td>
                  <td>{formatDate(ontology.created_at)}</td>
                  <td>
                    <div className="ontologies-table__actions">
                      {getNextOntologyStatuses(ontology.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          className="ontologies-page__button ontologies-page__button--secondary ontologies-table__action"
                          disabled={pendingOntologyId === ontology.id}
                          onClick={() => void handleStatusTransition(ontology.id, nextStatus)}
                        >
                          {getOntologyStatusActionLabel(nextStatus)}
                        </button>
                      ))}
                      {getNextOntologyStatuses(ontology.status).length === 0 && (
                        <span className="ontologies-table__no-actions">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
