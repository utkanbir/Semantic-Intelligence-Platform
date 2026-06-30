import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  createBlueprint,
  getBlueprintStatusActionLabel,
  getNextBlueprintStatuses,
  listBlueprints,
  updateBlueprintStatus,
  type BlueprintResponse,
  type BlueprintStatus,
} from "../api/blueprints";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; blueprints: BlueprintResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: BlueprintResponse["status"]): string {
  return `blueprint-table__status blueprint-table__status--${status.toLowerCase()}`;
}

interface CreateFormFields {
  title: string;
  goal: string;
  outcome: string;
  created_by: string;
}

interface BlueprintCreateFormProps {
  applicationId: string;
  onCreated: () => void;
  onCancel?: () => void;
}

function BlueprintCreateForm({
  applicationId,
  onCreated,
  onCancel,
}: BlueprintCreateFormProps) {
  const [fields, setFields] = useState<CreateFormFields>({
    title: "",
    goal: "",
    outcome: "",
    created_by: "",
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
      const goal = fields.goal.trim();
      const outcome = fields.outcome.trim();
      const createdBy = fields.created_by.trim();
      await createBlueprint({
        application_id: applicationId,
        title: trimmedTitle,
        ...(goal ? { goal } : {}),
        ...(outcome ? { outcome } : {}),
        ...(createdBy ? { created_by: createdBy } : {}),
        blueprint_snapshot: {},
      });
      onCreated();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create blueprint";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="blueprint-page__form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Create blueprint"
    >
      <div className="blueprint-page__field">
        <label htmlFor="blueprint-title">Title</label>
        <input
          id="blueprint-title"
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
          aria-describedby={titleError ? "blueprint-title-error" : undefined}
        />
        {titleError && (
          <p id="blueprint-title-error" className="blueprint-page__field-error" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="blueprint-page__field">
        <label htmlFor="blueprint-goal">
          Goal <span className="blueprint-page__optional">(optional)</span>
        </label>
        <textarea
          id="blueprint-goal"
          name="goal"
          rows={2}
          value={fields.goal}
          onChange={(event) =>
            setFields((current) => ({ ...current, goal: event.target.value }))
          }
        />
      </div>

      <div className="blueprint-page__field">
        <label htmlFor="blueprint-outcome">
          Outcome <span className="blueprint-page__optional">(optional)</span>
        </label>
        <textarea
          id="blueprint-outcome"
          name="outcome"
          rows={2}
          value={fields.outcome}
          onChange={(event) =>
            setFields((current) => ({ ...current, outcome: event.target.value }))
          }
        />
      </div>

      <div className="blueprint-page__field">
        <label htmlFor="blueprint-created-by">
          Created by <span className="blueprint-page__optional">(optional)</span>
        </label>
        <input
          id="blueprint-created-by"
          name="created_by"
          type="text"
          value={fields.created_by}
          onChange={(event) =>
            setFields((current) => ({ ...current, created_by: event.target.value }))
          }
        />
      </div>

      {submitError && (
        <div className="blueprint-page__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="blueprint-page__form-actions">
        {onCancel && (
          <button
            type="button"
            className="blueprint-page__button blueprint-page__button--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="blueprint-page__button blueprint-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create blueprint"}
        </button>
      </div>
    </form>
  );
}

interface BlueprintPageProps {
  applicationId: string;
}

export function BlueprintPage({ applicationId }: BlueprintPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingBlueprintId, setPendingBlueprintId] = useState<string | null>(null);

  const loadBlueprints = useCallback(() => {
    setState({ kind: "loading" });

    return listBlueprints(applicationId)
      .then((blueprints) => {
        setState({ kind: "success", blueprints });
        return blueprints;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load blueprints";
        setState({ kind: "error", message });
        throw error;
      });
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;

    listBlueprints(applicationId)
      .then((blueprints) => {
        if (!cancelled) {
          setState({ kind: "success", blueprints });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load blueprints";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  function handleCreated() {
    setShowCreateForm(false);
    void loadBlueprints();
  }

  async function handleStatusTransition(
    blueprintId: string,
    nextStatus: BlueprintStatus,
  ) {
    setActionError(null);
    setPendingBlueprintId(blueprintId);
    try {
      await updateBlueprintStatus(blueprintId, nextStatus);
      await loadBlueprints();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update blueprint status";
      setActionError(message);
    } finally {
      setPendingBlueprintId(null);
    }
  }

  const isEmpty = state.kind === "success" && state.blueprints.length === 0;
  const hasBlueprints = state.kind === "success" && state.blueprints.length > 0;

  return (
    <section className="blueprint-page" aria-labelledby="blueprint-heading">
      <div className="blueprint-page__header">
        <div>
          <h2 id="blueprint-heading">Blueprint</h2>
          <p className="blueprint-page__lead">
            Blueprints define the semantic architecture and provisioning plan derived from
            discovery sessions.
          </p>
        </div>
        {hasBlueprints && !showCreateForm && (
          <button
            type="button"
            className="blueprint-page__button blueprint-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New blueprint
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p className="blueprint-page__status" role="status" aria-live="polite">
          Loading blueprints…
        </p>
      )}

      {state.kind === "error" && (
        <div className="blueprint-page__error" role="alert">
          {state.message}
        </div>
      )}

      {actionError && (
        <div className="blueprint-page__error blueprint-page__action-error" role="alert">
          {actionError}
        </div>
      )}

      {isEmpty && (
        <div className="blueprint-page__empty" role="status">
          <p>No blueprints yet.</p>
          <p className="blueprint-page__hint">
            Create your first blueprint to get started.
          </p>
          <BlueprintCreateForm applicationId={applicationId} onCreated={handleCreated} />
        </div>
      )}

      {hasBlueprints && showCreateForm && (
        <div className="blueprint-page__create-panel">
          <h3 className="blueprint-page__create-title">New blueprint</h3>
          <BlueprintCreateForm
            applicationId={applicationId}
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {hasBlueprints && (
        <div className="blueprint-page__table-wrap">
          <table className="blueprint-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Version</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.blueprints.map((blueprint) => (
                <tr key={blueprint.id}>
                  <td>{blueprint.title}</td>
                  <td>
                    <span className={statusClassName(blueprint.status)}>
                      {blueprint.status}
                    </span>
                  </td>
                  <td>{blueprint.version_number}</td>
                  <td>{formatDate(blueprint.created_at)}</td>
                  <td>
                    <div className="blueprint-table__actions">
                      {getNextBlueprintStatuses(blueprint.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          className="blueprint-page__button blueprint-page__button--secondary blueprint-table__action"
                          disabled={pendingBlueprintId === blueprint.id}
                          onClick={() =>
                            void handleStatusTransition(blueprint.id, nextStatus)
                          }
                        >
                          {getBlueprintStatusActionLabel(nextStatus)}
                        </button>
                      ))}
                      {getNextBlueprintStatuses(blueprint.status).length === 0 && (
                        <span className="blueprint-table__no-actions">—</span>
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
