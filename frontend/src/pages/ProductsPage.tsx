import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  createProduct,
  listProducts,
  type PublishedDataProductResponse,
} from "../api/products";

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

interface CreateFormFields {
  title: string;
  description: string;
  created_by: string;
}

interface ProductCreateFormProps {
  applicationId: string;
  onCreated: () => void;
  onCancel?: () => void;
}

function ProductCreateForm({ applicationId, onCreated, onCancel }: ProductCreateFormProps) {
  const [fields, setFields] = useState<CreateFormFields>({
    title: "",
    description: "",
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
      const description = fields.description.trim();
      const createdBy = fields.created_by.trim();
      await createProduct({
        application_id: applicationId,
        title: trimmedTitle,
        product_definition: {},
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

interface ProductsPageProps {
  applicationId: string;
}

export function ProductsPage({ applicationId }: ProductsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [showCreateForm, setShowCreateForm] = useState(false);

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
  }, [applicationId]);

  function handleCreated() {
    setShowCreateForm(false);
    void loadProducts();
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

      {isEmpty && (
        <div className="products-page__empty" role="status">
          <p>No published data products yet.</p>
          <p className="products-page__hint">
            Create your first data product to get started.
          </p>
          <ProductCreateForm applicationId={applicationId} onCreated={handleCreated} />
        </div>
      )}

      {hasProducts && showCreateForm && (
        <div className="products-page__create-panel">
          <h3 className="products-page__create-title">New product</h3>
          <ProductCreateForm
            applicationId={applicationId}
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {hasProducts && (
        <div className="products-page__table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Version</th>
                <th scope="col">Published at</th>
              </tr>
            </thead>
            <tbody>
              {state.products.map((product) => (
                <tr key={product.id}>
                  <td>{product.title}</td>
                  <td>
                    <span className={statusClassName(product.status)}>{product.status}</span>
                  </td>
                  <td>{product.version_number}</td>
                  <td>{formatDate(product.published_at ?? product.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
