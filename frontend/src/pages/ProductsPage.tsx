import { useEffect, useState } from "react";
import { ApiError } from "../api";
import { listProducts, type PublishedDataProductResponse } from "../api/products";

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

interface ProductsPageProps {
  applicationId: string;
}

export function ProductsPage({ applicationId }: ProductsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });

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

  return (
    <section className="products-page" aria-labelledby="products-heading">
      <h2 id="products-heading">Products</h2>
      <p className="products-page__lead">
        Published data products are certified, versioned assets that agents consume
        instead of raw tables.
      </p>

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

      {state.kind === "success" && state.products.length === 0 && (
        <div className="products-page__empty" role="status">
          <p>No published data products yet.</p>
          <p className="products-page__hint">
            Create a product via the API to see it listed here.
          </p>
        </div>
      )}

      {state.kind === "success" && state.products.length > 0 && (
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
