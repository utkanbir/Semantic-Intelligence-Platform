import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  createKnowledgeGraph,
  getKnowledgeGraphStatusActionLabel,
  getNextKnowledgeGraphStatuses,
  listKnowledgeGraphs,
  updateKnowledgeGraphStatus,
  type KnowledgeGraphRegistryResponse,
  type KnowledgeGraphRegistryStatus,
} from "../api/knowledgeGraphs";
import {
  listOntologies,
  type OntologyDefinitionResponse,
} from "../api/ontologies";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; registries: KnowledgeGraphRegistryResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(
  status: KnowledgeGraphRegistryResponse["status"],
): string {
  return `knowledge-graphs-table__status knowledge-graphs-table__status--${status.toLowerCase()}`;
}

interface OntologyBindingsFieldProps {
  idPrefix: string;
  ontologies: OntologyDefinitionResponse[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
}

function OntologyBindingsField({
  idPrefix,
  ontologies,
  selectedIds,
  onChange,
  disabled = false,
}: OntologyBindingsFieldProps) {
  if (ontologies.length === 0) {
    return (
      <p className="knowledge-graphs-page__bindings-hint">
        No ontologies available to bind.
      </p>
    );
  }

  function toggleOntology(ontologyId: string) {
    if (selectedIds.includes(ontologyId)) {
      onChange(selectedIds.filter((id) => id !== ontologyId));
    } else {
      onChange([...selectedIds, ontologyId]);
    }
  }

  return (
    <fieldset className="knowledge-graphs-page__bindings-fieldset" disabled={disabled}>
      <legend>
        Bound ontologies <span className="knowledge-graphs-page__optional">(optional)</span>
      </legend>
      <ul className="knowledge-graphs-page__bindings-list">
        {ontologies.map((ontology) => {
          const inputId = `${idPrefix}-ontology-${ontology.id}`;
          return (
            <li key={ontology.id}>
              <label htmlFor={inputId} className="knowledge-graphs-page__bindings-option">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={selectedIds.includes(ontology.id)}
                  onChange={() => toggleOntology(ontology.id)}
                />
                <span>
                  {ontology.title}{" "}
                  <span className="knowledge-graphs-page__bindings-status">
                    ({ontology.status})
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

interface CreateFormFields {
  title: string;
  description: string;
  created_by: string;
  bound_ontology_ids: string[];
}

interface KnowledgeGraphCreateFormProps {
  applicationId: string;
  ontologies: OntologyDefinitionResponse[];
  onCreated: () => void;
  onCancel?: () => void;
}

function KnowledgeGraphCreateForm({
  applicationId,
  ontologies,
  onCreated,
  onCancel,
}: KnowledgeGraphCreateFormProps) {
  const [fields, setFields] = useState<CreateFormFields>({
    title: "",
    description: "",
    created_by: "",
    bound_ontology_ids: [],
  });
  const [titleError, setTitleError] = useState<string | null>(null);
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

    setSubmitting(true);
    try {
      const description = fields.description.trim();
      const createdBy = fields.created_by.trim();
      await createKnowledgeGraph({
        application_id: applicationId,
        title: trimmedTitle,
        ...(description ? { description } : {}),
        ...(createdBy ? { created_by: createdBy } : {}),
        ...(fields.bound_ontology_ids.length > 0
          ? { bound_ontology_ids: fields.bound_ontology_ids }
          : {}),
      });
      onCreated();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create knowledge graph";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="knowledge-graphs-page__form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Create knowledge graph"
    >
      <div className="knowledge-graphs-page__field">
        <label htmlFor="kg-title">Title</label>
        <input
          id="kg-title"
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
          aria-describedby={titleError ? "kg-title-error" : undefined}
        />
        {titleError && (
          <p id="kg-title-error" className="knowledge-graphs-page__field-error" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="knowledge-graphs-page__field">
        <label htmlFor="kg-description">
          Description <span className="knowledge-graphs-page__optional">(optional)</span>
        </label>
        <textarea
          id="kg-description"
          name="description"
          rows={3}
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>

      <div className="knowledge-graphs-page__field">
        <label htmlFor="kg-created-by">
          Created by <span className="knowledge-graphs-page__optional">(optional)</span>
        </label>
        <input
          id="kg-created-by"
          name="created_by"
          type="text"
          value={fields.created_by}
          onChange={(event) =>
            setFields((current) => ({ ...current, created_by: event.target.value }))
          }
        />
      </div>

      <OntologyBindingsField
        idPrefix="kg-create"
        ontologies={ontologies}
        selectedIds={fields.bound_ontology_ids}
        onChange={(bound_ontology_ids) =>
          setFields((current) => ({ ...current, bound_ontology_ids }))
        }
        disabled={submitting}
      />

      {submitError && (
        <div className="knowledge-graphs-page__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="knowledge-graphs-page__form-actions">
        {onCancel && (
          <button
            type="button"
            className="knowledge-graphs-page__button knowledge-graphs-page__button--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="knowledge-graphs-page__button knowledge-graphs-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create knowledge graph"}
        </button>
      </div>
    </form>
  );
}

interface KnowledgeGraphsPageProps {
  applicationId: string;
}

export function KnowledgeGraphsPage({ applicationId }: KnowledgeGraphsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [ontologies, setOntologies] = useState<OntologyDefinitionResponse[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingRegistryId, setPendingRegistryId] = useState<string | null>(null);

  const loadRegistries = useCallback(() => {
    setState({ kind: "loading" });

    return listKnowledgeGraphs(applicationId)
      .then((registries) => {
        setState({ kind: "success", registries });
        return registries;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load knowledge graphs";
        setState({ kind: "error", message });
        throw error;
      });
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([listKnowledgeGraphs(applicationId), listOntologies(applicationId)])
      .then(([registries, ontologyList]) => {
        if (!cancelled) {
          setOntologies(ontologyList);
          setState({ kind: "success", registries });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load knowledge graphs";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  function handleCreated() {
    setShowCreateForm(false);
    void loadRegistries();
  }

  async function handleStatusTransition(
    registryId: string,
    nextStatus: KnowledgeGraphRegistryStatus,
  ) {
    setActionError(null);
    setPendingRegistryId(registryId);
    try {
      await updateKnowledgeGraphStatus(registryId, nextStatus);
      await loadRegistries();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update knowledge graph status";
      setActionError(message);
    } finally {
      setPendingRegistryId(null);
    }
  }

  const isEmpty = state.kind === "success" && state.registries.length === 0;
  const hasRegistries = state.kind === "success" && state.registries.length > 0;

  return (
    <section className="knowledge-graphs-page" aria-labelledby="knowledge-graphs-heading">
      <div className="knowledge-graphs-page__header">
        <div>
          <h2 id="knowledge-graphs-heading">Knowledge graph</h2>
          <p className="knowledge-graphs-page__lead">
            Knowledge graph registries track populated semantic graphs for this
            application&apos;s ontology-bound data.
          </p>
        </div>
        {hasRegistries && !showCreateForm && (
          <button
            type="button"
            className="knowledge-graphs-page__button knowledge-graphs-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New knowledge graph
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p className="knowledge-graphs-page__status" role="status" aria-live="polite">
          Loading knowledge graphs…
        </p>
      )}

      {state.kind === "error" && (
        <div className="knowledge-graphs-page__error" role="alert">
          {state.message}
        </div>
      )}

      {actionError && (
        <div
          className="knowledge-graphs-page__error knowledge-graphs-page__action-error"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {isEmpty && (
        <div className="knowledge-graphs-page__empty" role="status">
          <p>No knowledge graph registries yet.</p>
          <p className="knowledge-graphs-page__hint">
            Create your first knowledge graph registry to get started.
          </p>
          <KnowledgeGraphCreateForm
            applicationId={applicationId}
            ontologies={ontologies}
            onCreated={handleCreated}
          />
        </div>
      )}

      {hasRegistries && showCreateForm && (
        <div className="knowledge-graphs-page__create-panel">
          <h3 className="knowledge-graphs-page__create-title">New knowledge graph</h3>
          <KnowledgeGraphCreateForm
            applicationId={applicationId}
            ontologies={ontologies}
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {hasRegistries && (
        <div className="knowledge-graphs-page__table-wrap">
          <table className="knowledge-graphs-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Created at</th>
                <th scope="col">Populated at</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.registries.map((registry) => (
                <tr key={registry.id}>
                  <td>{registry.title}</td>
                  <td>
                    <span className={statusClassName(registry.status)}>{registry.status}</span>
                  </td>
                  <td>{formatDate(registry.created_at)}</td>
                  <td>{formatDate(registry.populated_at)}</td>
                  <td>
                    <div className="knowledge-graphs-table__actions">
                      {getNextKnowledgeGraphStatuses(registry.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          className="knowledge-graphs-page__button knowledge-graphs-page__button--secondary knowledge-graphs-table__action"
                          disabled={pendingRegistryId === registry.id}
                          onClick={() => void handleStatusTransition(registry.id, nextStatus)}
                        >
                          {getKnowledgeGraphStatusActionLabel(nextStatus)}
                        </button>
                      ))}
                      {getNextKnowledgeGraphStatuses(registry.status).length === 0 && (
                        <span className="knowledge-graphs-table__no-actions">—</span>
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
