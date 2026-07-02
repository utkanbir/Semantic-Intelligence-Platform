import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api";
import { listAssets, type AssetRecordResponse } from "../api/assets";
import {
  canEditProductBindings,
  canForkProduct,
  createProduct,
  forkProductVersion,
  getNextProductStatuses,
  getProductStatusActionLabel,
  listProducts,
  updateProduct,
  updateProductStatus,
  type PublishedDataProductResponse,
  type PublishedDataProductStatus,
} from "../api/products";
import { formatVersionChain } from "../utils/versionChain";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; products: PublishedDataProductResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: PublishedDataProductResponse["status"]): string {
  return `products-table__status products-table__status--${status.toLowerCase()}`;
}

function formatBoundSourceAssets(
  product: PublishedDataProductResponse,
  assetTitleById: Map<string, string>,
): string {
  if (product.source_asset_record_ids.length === 0) {
    return "None";
  }
  const titles = product.source_asset_record_ids.map(
    (id) => assetTitleById.get(id) ?? id,
  );
  return `${product.source_asset_record_ids.length}: ${titles.join(", ")}`;
}

interface SourceAssetBindingsFieldProps {
  idPrefix: string;
  assets: AssetRecordResponse[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
}

function SourceAssetBindingsField({
  idPrefix,
  assets,
  selectedIds,
  onChange,
  disabled = false,
}: SourceAssetBindingsFieldProps) {
  if (assets.length === 0) {
    return (
      <p className="products-page__bindings-hint">No assets available to bind.</p>
    );
  }

  function toggleAsset(assetId: string) {
    if (selectedIds.includes(assetId)) {
      onChange(selectedIds.filter((id) => id !== assetId));
    } else {
      onChange([...selectedIds, assetId]);
    }
  }

  return (
    <fieldset className="products-page__bindings-fieldset" disabled={disabled}>
      <legend>
        Source assets <span className="products-page__optional">(optional)</span>
      </legend>
      <ul className="products-page__bindings-list">
        {assets.map((asset) => {
          const inputId = `${idPrefix}-asset-${asset.id}`;
          return (
            <li key={asset.id}>
              <label htmlFor={inputId} className="products-page__bindings-option">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={selectedIds.includes(asset.id)}
                  onChange={() => toggleAsset(asset.id)}
                />
                <span>
                  {asset.title}{" "}
                  <span className="products-page__bindings-status">({asset.asset_type})</span>
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
  source_asset_record_ids: string[];
}

interface ProductCreateFormProps {
  applicationId: string;
  assets: AssetRecordResponse[];
  onCreated: () => void;
  onCancel?: () => void;
}

function ProductCreateForm({
  applicationId,
  assets,
  onCreated,
  onCancel,
}: ProductCreateFormProps) {
  const [fields, setFields] = useState<CreateFormFields>({
    title: "",
    description: "",
    created_by: "",
    source_asset_record_ids: [],
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
      await createProduct({
        application_id: applicationId,
        title: trimmedTitle,
        product_definition: {},
        ...(description ? { description } : {}),
        ...(createdBy ? { created_by: createdBy } : {}),
        ...(fields.source_asset_record_ids.length > 0
          ? { source_asset_record_ids: fields.source_asset_record_ids }
          : {}),
      });
      onCreated();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create product";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="products-page__form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Create product"
    >
      <div className="products-page__field">
        <label htmlFor="product-title">Title</label>
        <input
          id="product-title"
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
          aria-describedby={titleError ? "product-title-error" : undefined}
        />
        {titleError && (
          <p id="product-title-error" className="products-page__field-error" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="products-page__field">
        <label htmlFor="product-description">
          Description <span className="products-page__optional">(optional)</span>
        </label>
        <textarea
          id="product-description"
          name="description"
          rows={3}
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>

      <div className="products-page__field">
        <label htmlFor="product-created-by">
          Created by <span className="products-page__optional">(optional)</span>
        </label>
        <input
          id="product-created-by"
          name="created_by"
          type="text"
          value={fields.created_by}
          onChange={(event) =>
            setFields((current) => ({ ...current, created_by: event.target.value }))
          }
        />
      </div>

      <SourceAssetBindingsField
        idPrefix="product-create"
        assets={assets}
        selectedIds={fields.source_asset_record_ids}
        onChange={(source_asset_record_ids) =>
          setFields((current) => ({ ...current, source_asset_record_ids }))
        }
        disabled={submitting}
      />

      {submitError && (
        <div className="products-page__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="products-page__form-actions">
        {onCancel && (
          <button
            type="button"
            className="products-page__button products-page__button--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="products-page__button products-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create product"}
        </button>
      </div>
    </form>
  );
}

interface ProductBindingsDialogProps {
  product: PublishedDataProductResponse;
  assets: AssetRecordResponse[];
  onClose: () => void;
  onSaved: () => void;
}

function ProductBindingsDialog({
  product,
  assets,
  onClose,
  onSaved,
}: ProductBindingsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(product.source_asset_record_ids);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await updateProduct(product.id, { source_asset_record_ids: selectedIds });
      onSaved();
      onClose();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update product bindings";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      className="agents-page__dialog"
      open
      aria-labelledby={`product-bindings-dialog-title-${product.id}`}
    >
      <div className="agents-page__dialog-panel">
        <h3
          id={`product-bindings-dialog-title-${product.id}`}
          className="agents-page__dialog-title"
        >
          Edit bindings — {product.title}
        </h3>
        <p className="agents-page__dialog-lead">
          Select source assets for this published data product.
        </p>
        <SourceAssetBindingsField
          idPrefix={`product-bindings-${product.id}`}
          assets={assets}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          disabled={submitting}
        />
        {submitError && (
          <div className="products-page__error" role="alert">
            {submitError}
          </div>
        )}
        <div className="products-page__form-actions">
          <button
            type="button"
            className="products-page__button products-page__button--secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="products-page__button products-page__button--primary"
            onClick={() => void handleSave()}
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save bindings"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface ProductsPageProps {
  applicationId: string;
}

export function ProductsPage({ applicationId }: ProductsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [assets, setAssets] = useState<AssetRecordResponse[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PublishedDataProductResponse | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  const assetTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of assets) {
      map.set(asset.id, asset.title);
    }
    return map;
  }, [assets]);

  const loadAssets = useCallback(() => {
    return listAssets(applicationId)
      .then((loadedAssets) => {
        setAssets(loadedAssets);
        return loadedAssets;
      })
      .catch(() => {
        setAssets([]);
      });
  }, [applicationId]);

  const loadProducts = useCallback(() => {
    setState({ kind: "loading" });

    return listProducts(applicationId)
      .then((products) => {
        setState({ kind: "success", products });
        return products;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load products";
        setState({ kind: "error", message });
        throw error;
      });
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;

    void loadAssets();

    listProducts(applicationId)
      .then((products) => {
        if (!cancelled) {
          setState({ kind: "success", products });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load products";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, loadAssets]);

  function handleCreated() {
    setShowCreateForm(false);
    void loadProducts();
    void loadAssets();
  }

  function handleBindingsSaved() {
    void loadProducts();
  }

  async function handleStatusTransition(
    productId: string,
    nextStatus: PublishedDataProductStatus,
  ) {
    setActionError(null);
    setPendingProductId(productId);
    try {
      await updateProductStatus(productId, nextStatus);
      await loadProducts();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update product status";
      setActionError(message);
    } finally {
      setPendingProductId(null);
    }
  }

  async function handleForkVersion(productId: string) {
    setActionError(null);
    setPendingProductId(productId);
    try {
      await forkProductVersion(productId);
      await loadProducts();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create product version";
      setActionError(message);
    } finally {
      setPendingProductId(null);
    }
  }

  const isEmpty = state.kind === "success" && state.products.length === 0;
  const hasProducts = state.kind === "success" && state.products.length > 0;

  return (
    <section className="products-page" aria-labelledby="products-heading">
      <div className="products-page__header">
        <div>
          <h2 id="products-heading">Products</h2>
          <p className="products-page__lead">
            Published data products are certified, versioned assets that agents consume
            instead of raw tables.
          </p>
        </div>
        {hasProducts && !showCreateForm && (
          <button
            type="button"
            className="products-page__button products-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New product
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p className="products-page__status" role="status" aria-live="polite">
          Loading products…
        </p>
      )}

      {state.kind === "error" && (
        <div className="products-page__error" role="alert">
          {state.message}
        </div>
      )}

      {actionError && (
        <div className="products-page__error products-page__action-error" role="alert">
          {actionError}
        </div>
      )}

      {isEmpty && (
        <div className="products-page__empty" role="status">
          <p>No published data products yet.</p>
          <p className="products-page__hint">
            Create your first data product to get started.
          </p>
          <ProductCreateForm
            applicationId={applicationId}
            assets={assets}
            onCreated={handleCreated}
          />
        </div>
      )}

      {hasProducts && showCreateForm && (
        <div className="products-page__create-panel">
          <h3 className="products-page__create-title">New product</h3>
          <ProductCreateForm
            applicationId={applicationId}
            assets={assets}
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {editingProduct && (
        <ProductBindingsDialog
          product={editingProduct}
          assets={assets}
          onClose={() => setEditingProduct(null)}
          onSaved={handleBindingsSaved}
        />
      )}

      {hasProducts && (
        <div className="products-page__table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Source assets</th>
                <th scope="col">Version</th>
                <th scope="col">Published at</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.products.map((product) => (
                <tr key={product.id}>
                  <td>{product.title}</td>
                  <td>
                    <span className={statusClassName(product.status)}>{product.status}</span>
                  </td>
                  <td className="products-table__bindings">
                    {formatBoundSourceAssets(product, assetTitleById)}
                  </td>
                  <td>{formatVersionChain(product, state.products)}</td>
                  <td>{formatDate(product.published_at ?? product.created_at)}</td>
                  <td>
                    <div className="products-table__actions">
                      {canEditProductBindings(product) && (
                        <button
                          type="button"
                          className="products-page__button products-page__button--secondary products-table__action"
                          disabled={pendingProductId === product.id}
                          onClick={() => setEditingProduct(product)}
                        >
                          Edit bindings
                        </button>
                      )}
                      {canForkProduct(product) && (
                        <button
                          type="button"
                          className="products-page__button products-page__button--secondary products-table__action"
                          disabled={pendingProductId === product.id}
                          onClick={() => void handleForkVersion(product.id)}
                        >
                          New version
                        </button>
                      )}
                      {getNextProductStatuses(product.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          className="products-page__button products-page__button--secondary products-table__action"
                          disabled={pendingProductId === product.id}
                          onClick={() => void handleStatusTransition(product.id, nextStatus)}
                        >
                          {getProductStatusActionLabel(nextStatus)}
                        </button>
                      ))}
                      {getNextProductStatuses(product.status).length === 0 &&
                        !canForkProduct(product) &&
                        !canEditProductBindings(product) && (
                          <span className="products-table__no-actions">—</span>
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
