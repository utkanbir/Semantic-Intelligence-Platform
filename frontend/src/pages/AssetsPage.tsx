import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  ASSET_TYPES,
  createAsset,
  listAssets,
  type AssetRecordResponse,
  type AssetType,
} from "../api/assets";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; assets: AssetRecordResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: AssetRecordResponse["status"]): string {
  return `assets-table__status assets-table__status--${status.toLowerCase()}`;
}

interface CreateFormFields {
  asset_type: AssetType;
  resource_type: string;
  resource_id: string;
  title: string;
  description: string;
  created_by: string;
  metadata_json: string;
}

interface AssetCreateFormProps {
  applicationId: string;
  onCreated: () => void;
  onCancel?: () => void;
}

function AssetCreateForm({ applicationId, onCreated, onCancel }: AssetCreateFormProps) {
  const [fields, setFields] = useState<CreateFormFields>({
    asset_type: "Blueprint",
    resource_type: "",
    resource_id: "",
    title: "",
    description: "",
    created_by: "",
    metadata_json: "",
  });
  const [titleError, setTitleError] = useState<string | null>(null);
  const [resourceTypeError, setResourceTypeError] = useState<string | null>(null);
  const [resourceIdError, setResourceIdError] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
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

    const trimmedResourceType = fields.resource_type.trim();
    if (!trimmedResourceType) {
      setResourceTypeError("Resource type is required");
      return;
    }
    setResourceTypeError(null);

    const trimmedResourceId = fields.resource_id.trim();
    if (!trimmedResourceId) {
      setResourceIdError("Resource ID is required");
      return;
    }
    setResourceIdError(null);

    const trimmedMetadata = fields.metadata_json.trim();
    let metadata: Record<string, unknown> | undefined;
    if (trimmedMetadata) {
      try {
        const parsed: unknown = JSON.parse(trimmedMetadata);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          setMetadataError("Metadata must be a JSON object");
          return;
        }
        metadata = parsed as Record<string, unknown>;
      } catch {
        setMetadataError("Metadata must be valid JSON");
        return;
      }
    }
    setMetadataError(null);

    setSubmitting(true);
    try {
      const description = fields.description.trim();
      const createdBy = fields.created_by.trim();
      await createAsset({
        application_id: applicationId,
        asset_type: fields.asset_type,
        resource_type: trimmedResourceType,
        resource_id: trimmedResourceId,
        title: trimmedTitle,
        ...(description ? { description } : {}),
        ...(createdBy ? { created_by: createdBy } : {}),
        ...(metadata ? { metadata } : {}),
      });
      onCreated();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create asset";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="assets-page__form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Create asset"
    >
      <div className="assets-page__field">
        <label htmlFor="asset-type">Asset type</label>
        <select
          id="asset-type"
          name="asset_type"
          value={fields.asset_type}
          onChange={(event) =>
            setFields((current) => ({
              ...current,
              asset_type: event.target.value as AssetType,
            }))
          }
        >
          {ASSET_TYPES.map((assetType) => (
            <option key={assetType} value={assetType}>
              {assetType}
            </option>
          ))}
        </select>
      </div>

      <div className="assets-page__field">
        <label htmlFor="asset-resource-type">Resource type</label>
        <input
          id="asset-resource-type"
          name="resource_type"
          type="text"
          value={fields.resource_type}
          onChange={(event) => {
            setFields((current) => ({ ...current, resource_type: event.target.value }));
            if (resourceTypeError) {
              setResourceTypeError(null);
            }
          }}
          aria-invalid={resourceTypeError ? true : undefined}
          aria-describedby={resourceTypeError ? "asset-resource-type-error" : undefined}
        />
        {resourceTypeError && (
          <p id="asset-resource-type-error" className="assets-page__field-error" role="alert">
            {resourceTypeError}
          </p>
        )}
      </div>

      <div className="assets-page__field">
        <label htmlFor="asset-resource-id">Resource ID</label>
        <input
          id="asset-resource-id"
          name="resource_id"
          type="text"
          value={fields.resource_id}
          onChange={(event) => {
            setFields((current) => ({ ...current, resource_id: event.target.value }));
            if (resourceIdError) {
              setResourceIdError(null);
            }
          }}
          aria-invalid={resourceIdError ? true : undefined}
          aria-describedby={resourceIdError ? "asset-resource-id-error" : undefined}
        />
        {resourceIdError && (
          <p id="asset-resource-id-error" className="assets-page__field-error" role="alert">
            {resourceIdError}
          </p>
        )}
      </div>

      <div className="assets-page__field">
        <label htmlFor="asset-title">Title</label>
        <input
          id="asset-title"
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
          aria-describedby={titleError ? "asset-title-error" : undefined}
        />
        {titleError && (
          <p id="asset-title-error" className="assets-page__field-error" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="assets-page__field">
        <label htmlFor="asset-description">
          Description <span className="assets-page__optional">(optional)</span>
        </label>
        <textarea
          id="asset-description"
          name="description"
          rows={3}
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>

      <div className="assets-page__field">
        <label htmlFor="asset-created-by">
          Created by <span className="assets-page__optional">(optional)</span>
        </label>
        <input
          id="asset-created-by"
          name="created_by"
          type="text"
          value={fields.created_by}
          onChange={(event) =>
            setFields((current) => ({ ...current, created_by: event.target.value }))
          }
        />
      </div>

      <div className="assets-page__field">
        <label htmlFor="asset-metadata">
          Metadata <span className="assets-page__optional">(optional JSON)</span>
        </label>
        <textarea
          id="asset-metadata"
          name="metadata"
          rows={4}
          placeholder="{}"
          value={fields.metadata_json}
          onChange={(event) => {
            setFields((current) => ({ ...current, metadata_json: event.target.value }));
            if (metadataError) {
              setMetadataError(null);
            }
          }}
          aria-invalid={metadataError ? true : undefined}
          aria-describedby={metadataError ? "asset-metadata-error" : undefined}
        />
        {metadataError && (
          <p id="asset-metadata-error" className="assets-page__field-error" role="alert">
            {metadataError}
          </p>
        )}
      </div>

      {submitError && (
        <div className="assets-page__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="assets-page__form-actions">
        {onCancel && (
          <button
            type="button"
            className="assets-page__button assets-page__button--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="assets-page__button assets-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create asset"}
        </button>
      </div>
    </form>
  );
}

interface AssetsPageProps {
  applicationId: string;
}

export function AssetsPage({ applicationId }: AssetsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadAssets = useCallback(() => {
    setState({ kind: "loading" });

    return listAssets(applicationId)
      .then((assets) => {
        setState({ kind: "success", assets });
        return assets;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load assets";
        setState({ kind: "error", message });
        throw error;
      });
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;

    listAssets(applicationId)
      .then((assets) => {
        if (!cancelled) {
          setState({ kind: "success", assets });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load assets";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  function handleCreated() {
    setShowCreateForm(false);
    void loadAssets();
  }

  const isEmpty = state.kind === "success" && state.assets.length === 0;
  const hasAssets = state.kind === "success" && state.assets.length > 0;

  return (
    <section className="assets-page" aria-labelledby="assets-heading">
      <div className="assets-page__header">
        <div>
          <h2 id="assets-heading">Assets</h2>
          <p className="assets-page__lead">
            Registered assets for this application, including discovery sessions, blueprints,
            and related resources.
          </p>
        </div>
        {hasAssets && !showCreateForm && (
          <button
            type="button"
            className="assets-page__button assets-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New asset
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p className="assets-page__status" role="status" aria-live="polite">
          Loading assets…
        </p>
      )}

      {state.kind === "error" && (
        <div className="assets-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="assets-page__empty" role="status">
          <p>No assets registered yet.</p>
          <p className="assets-page__hint">Create your first asset record to get started.</p>
          <AssetCreateForm applicationId={applicationId} onCreated={handleCreated} />
        </div>
      )}

      {hasAssets && showCreateForm && (
        <div className="assets-page__create-panel">
          <h3 className="assets-page__create-title">New asset</h3>
          <AssetCreateForm
            applicationId={applicationId}
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {hasAssets && (
        <div className="assets-page__table-wrap">
          <table className="assets-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Asset type</th>
                <th scope="col">Resource type</th>
                <th scope="col">Status</th>
                <th scope="col">Created at</th>
              </tr>
            </thead>
            <tbody>
              {state.assets.map((asset) => (
                <tr key={asset.id}>
                  <td>{asset.title}</td>
                  <td>{asset.asset_type}</td>
                  <td>{asset.resource_type}</td>
                  <td>
                    <span className={statusClassName(asset.status)}>{asset.status}</span>
                  </td>
                  <td>{formatDate(asset.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
