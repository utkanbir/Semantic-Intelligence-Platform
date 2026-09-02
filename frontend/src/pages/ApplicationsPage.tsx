import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api";
import {
  createApplication,
  listApplications,
  type ApplicationResponse,
  type ApplicationWorkspaceResponse,
} from "../api/applications";
import {
  sandboxStatusBadge,
  sortApplicationsByRecent,
} from "./platform/homeUtils";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; applications: ApplicationResponse[] };

const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface MetadataRow {
  label: string;
  value: string;
}

function formatRelativeTimeTr(iso: string | null): string {
  if (!iso) {
    return "henüz kullanılmadı";
  }

  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return "henüz kullanılmadı";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "az önce";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} dakika önce`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} saat önce`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} gün önce`;
  }

  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(timestamp));
}

function sandboxMetadataRows(workspace: ApplicationWorkspaceResponse): MetadataRow[] {
  return [
    {
      label: "Ontology / KG",
      value: workspace.fuseki_dataset
        ? `Fuseki (${workspace.fuseki_dataset})`
        : "bağlı değil",
    },
    {
      label: "Glossary / Catalog",
      value: workspace.metadata_domain || "bağlı değil",
    },
    {
      label: "Vector store",
      value: workspace.qdrant_collection ? "Qdrant" : "bağlı değil",
    },
    {
      label: "Database",
      value: workspace.postgres_schema ? "PostgreSQL" : "bağlı değil",
    },
  ];
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
      errors.key = "Anahtar gerekli";
    } else if (!KEY_PATTERN.test(trimmedKey)) {
      errors.key = "Yalnızca küçük harf, rakam ve tire kullanın";
    }

    if (!trimmedName) {
      errors.name = "Ad gerekli";
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
            : "Sandbox oluşturulamadı";
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
      aria-label="Yeni sandbox oluştur"
    >
      <div className="applications-page__field">
        <label htmlFor="application-key">Anahtar</label>
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
          Küçük harf, rakam ve tire (ör. <code>my-app</code>)
        </p>
        {fieldErrors.key && (
          <p id="application-key-error" className="applications-page__field-error" role="alert">
            {fieldErrors.key}
          </p>
        )}
      </div>

      <div className="applications-page__field">
        <label htmlFor="application-name">Ad</label>
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
          Açıklama <span className="applications-page__optional">(isteğe bağlı)</span>
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
            İptal
          </button>
        )}
        <button
          type="submit"
          className="applications-page__button applications-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Oluşturuluyor…" : "Sandbox oluştur"}
        </button>
      </div>
    </form>
  );
}

interface SandboxCardProps {
  application: ApplicationResponse;
}

function SandboxCard({ application }: SandboxCardProps) {
  const badge = sandboxStatusBadge(application.status);
  const metadata = sandboxMetadataRows(application.workspace);
  const lastUsed = formatRelativeTimeTr(
    application.updated_at ?? application.created_at,
  );

  return (
    <article className="sandbox-card" aria-labelledby={`sandbox-${application.id}-title`}>
      <header className="sandbox-card__header">
        <h2 id={`sandbox-${application.id}-title`} className="sandbox-card__title">
          {application.name}
        </h2>
        <span className={`sandbox-card__badge sandbox-card__badge--${badge.tone}`}>
          {badge.label}
        </span>
      </header>

      <dl className="sandbox-card__meta">
        {metadata.map((row) => (
          <div key={row.label} className="sandbox-card__meta-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <footer className="sandbox-card__footer">
        <span className="sandbox-card__last-used">Son kullanım: {lastUsed}</span>
        <Link to={`/applications/${application.id}`} className="sandbox-card__open">
          Aç
        </Link>
      </footer>
    </article>
  );
}

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [showCreateForm, setShowCreateForm] = useState(
    () => searchParams.get("create") === "1",
  );

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
              : "Sandbox listesi yüklenemedi";
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
                : "Sandbox listesi yüklenemedi";
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
  const applications =
    state.kind === "success" ? sortApplicationsByRecent(state.applications) : [];

  return (
    <section className="sandbox-list-page" aria-labelledby="sandbox-list-heading">
      <header className="sandbox-list-page__header">
        <h1 id="sandbox-list-heading" className="sandbox-list-page__title">
          Sandboxlar
        </h1>
        {(hasApplications || isEmpty) && !showCreateForm && (
          <button
            type="button"
            className="sandbox-list-page__button sandbox-list-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            + Yeni sandbox
          </button>
        )}
      </header>

      {state.kind === "loading" && (
        <p className="sandbox-list-page__status" role="status" aria-live="polite">
          Yükleniyor…
        </p>
      )}

      {state.kind === "error" && (
        <div className="sandbox-list-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && !showCreateForm && (
        <div className="sandbox-list-page__empty" role="status">
          <p>Henüz sandbox yok.</p>
          <p className="sandbox-list-page__hint">
            İlk sandbox&apos;ınızı oluşturarak başlayın.
          </p>
          <button
            type="button"
            className="sandbox-list-page__create-card"
            onClick={() => setShowCreateForm(true)}
          >
            + Yeni sandbox oluştur
          </button>
        </div>
      )}

      {isEmpty && showCreateForm && (
        <div className="sandbox-list-page__create-panel">
          <h2 className="sandbox-list-page__create-title">Yeni sandbox</h2>
          <ApplicationCreateForm
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {hasApplications && showCreateForm && (
        <div className="sandbox-list-page__create-panel">
          <h2 className="sandbox-list-page__create-title">Yeni sandbox</h2>
          <ApplicationCreateForm
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {hasApplications && (
        <div className="sandbox-list-page__grid">
          {applications.map((application) => (
            <SandboxCard key={application.id} application={application} />
          ))}

          {!showCreateForm && (
            <button
              type="button"
              className="sandbox-list-page__create-card sandbox-list-page__create-card--inline"
              onClick={() => setShowCreateForm(true)}
            >
              + Yeni sandbox oluştur
            </button>
          )}
        </div>
      )}
    </section>
  );
}
