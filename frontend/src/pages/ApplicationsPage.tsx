import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import {
  createApplication,
  listApplications,
  type ApplicationResponse,
} from "../api/applications";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; applications: ApplicationResponse[] };

const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusLabel(status: ApplicationResponse["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

interface CreateFormFields {
  key: string;
  name: string;
  description: string;
}

interface CreateFormProps {
  onCreated: (application: ApplicationResponse) => void;
  onCancel?: () => void;
}

function ApplicationCreateForm({ onCreated, onCancel }: CreateFormProps) {
  const [fields, setFields] = useState<CreateFormFields>({
    key: "",
    name: "",
    description: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<CreateFormFields>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errors: Partial<CreateFormFields> = {};
    const trimmedKey = fields.key.trim();
    const trimmedName = fields.name.trim();

    if (!trimmedKey) {
      errors.key = "Key is required";
    } else if (!KEY_PATTERN.test(trimmedKey)) {
      errors.key = "Use lowercase letters, numbers, and dashes only";
    }

    if (!trimmedName) {
      errors.name = "Name is required";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      const description = fields.description.trim();
      const application = await createApplication({
        key: fields.key.trim(),
        name: fields.name.trim(),
        ...(description ? { description } : {}),
      });
      onCreated(application);
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create application";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="applications-page__form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Create application"
    >
      <div className="applications-page__field">
        <label htmlFor="application-key">Key</label>
        <input
          id="application-key"
          name="key"
          type="text"
          autoComplete="off"
          value={fields.key}
          onChange={(event) => {
            setFields((current) => ({ ...current, key: event.target.value }));
            if (fieldErrors.key) {
              setFieldErrors((current) => ({ ...current, key: undefined }));
            }
          }}
          aria-invalid={fieldErrors.key ? true : undefined}
          aria-describedby="application-key-hint application-key-error"
        />
        <p id="application-key-hint" className="applications-page__field-hint">
          Lowercase letters, numbers, and dashes (e.g. <code>my-app</code>)
        </p>
        {fieldErrors.key && (
          <p id="application-key-error" className="applications-page__field-error" role="alert">
            {fieldErrors.key}
          </p>
        )}
      </div>

      <div className="applications-page__field">
        <label htmlFor="application-name">Name</label>
        <input
          id="application-name"
          name="name"
          type="text"
          value={fields.name}
          onChange={(event) => {
            setFields((current) => ({ ...current, name: event.target.value }));
            if (fieldErrors.name) {
              setFieldErrors((current) => ({ ...current, name: undefined }));
            }
          }}
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? "application-name-error" : undefined}
        />
        {fieldErrors.name && (
          <p id="application-name-error" className="applications-page__field-error" role="alert">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="applications-page__field">
        <label htmlFor="application-description">
          Description <span className="applications-page__optional">(optional)</span>
        </label>
        <textarea
          id="application-description"
          name="description"
          rows={3}
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>

      {submitError && (
        <div className="applications-page__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="applications-page__form-actions">
        {onCancel && (
          <button
            type="button"
            className="applications-page__button applications-page__button--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="applications-page__button applications-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create application"}
        </button>
      </div>
    </form>
  );
}

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadApplications = useCallback(() => {
    setState({ kind: "loading" });

    return listApplications()
      .then((applications) => {
        setState({ kind: "success", applications });
        return applications;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load applications";
        setState({ kind: "error", message });
        throw error;
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    listApplications()
      .then((applications) => {
        if (!cancelled) {
          setState({ kind: "success", applications });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load applications";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated(application: ApplicationResponse) {
    void loadApplications().finally(() => {
      navigate(`/applications/${application.id}`);
    });
  }

  const isEmpty =
    state.kind === "success" && state.applications.length === 0;
  const hasApplications =
    state.kind === "success" && state.applications.length > 0;

  return (
    <section className="applications-page">
      <div className="applications-page__header">
        <div>
          <h1>Applications</h1>
          <p className="applications-page__lead">
            Select an application to manage discovery, assets, and data products. The
            console is organized around your applications—not underlying technologies.
          </p>
        </div>
        {hasApplications && !showCreateForm && (
          <button
            type="button"
            className="applications-page__button applications-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New application
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p className="applications-page__status" role="status" aria-live="polite">
          Loading applications…
        </p>
      )}

      {state.kind === "error" && (
        <div className="applications-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="applications-page__empty" role="status">
          <p>No applications yet.</p>
          <p className="applications-page__hint">
            Create your first application to get started.
          </p>
          <ApplicationCreateForm onCreated={handleCreated} />
        </div>
      )}

      {hasApplications && showCreateForm && (
        <div className="applications-page__create-panel">
          <h2 className="applications-page__create-title">New application</h2>
          <ApplicationCreateForm
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {hasApplications && (
        <div className="applications-page__table-wrap">
          <table className="applications-table">
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {state.applications.map((application) => (
                <tr key={application.id}>
                  <td>
                    <Link
                      to={`/applications/${application.id}`}
                      className="applications-table__link"
                    >
                      <code className="applications-table__key">{application.key}</code>
                    </Link>
                  </td>
                  <td>
                    <Link
                      to={`/applications/${application.id}`}
                      className="applications-table__link"
                    >
                      {application.name}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`applications-table__status applications-table__status--${application.status}`}
                    >
                      {statusLabel(application.status)}
                    </span>
                  </td>
                  <td>{formatDate(application.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
