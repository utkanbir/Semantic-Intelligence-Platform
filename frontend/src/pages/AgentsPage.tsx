import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api";
import {
  canForkAgent,
  createAgent,
  forkAgentVersion,
  getAgentStatusActionLabel,
  getNextAgentStatuses,
  listAgents,
  updateAgent,
  updateAgentStatus,
  type AgentDefinitionResponse,
  type AgentDefinitionStatus,
} from "../api/agents";
import {
  isConsumableProduct,
  listProducts,
  type PublishedDataProductResponse,
} from "../api/products";
import { formatVersionChain } from "../utils/versionChain";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; agents: AgentDefinitionResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: AgentDefinitionResponse["status"]): string {
  return `agents-table__status agents-table__status--${status.toLowerCase()}`;
}

function canEditBindings(status: AgentDefinitionResponse["status"]): boolean {
  return status === "Draft" || status === "Approved";
}

function formatBoundProducts(
  agent: AgentDefinitionResponse,
  productTitleById: Map<string, string>,
): string {
  if (agent.bound_product_ids.length === 0) {
    return "None";
  }
  const titles = agent.bound_product_ids.map(
    (id) => productTitleById.get(id) ?? id,
  );
  return `${agent.bound_product_ids.length}: ${titles.join(", ")}`;
}

interface ProductBindingsFieldProps {
  idPrefix: string;
  products: PublishedDataProductResponse[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
}

function ProductBindingsField({
  idPrefix,
  products,
  selectedIds,
  onChange,
  disabled = false,
}: ProductBindingsFieldProps) {
  if (products.length === 0) {
    return (
      <p className="agents-page__bindings-hint">
        No Published or Versioned products available to bind.
      </p>
    );
  }

  function toggleProduct(productId: string) {
    if (selectedIds.includes(productId)) {
      onChange(selectedIds.filter((id) => id !== productId));
    } else {
      onChange([...selectedIds, productId]);
    }
  }

  return (
    <fieldset className="agents-page__bindings-fieldset" disabled={disabled}>
      <legend>
        Bound products <span className="agents-page__optional">(optional)</span>
      </legend>
      <ul className="agents-page__bindings-list">
        {products.map((product) => {
          const inputId = `${idPrefix}-product-${product.id}`;
          return (
            <li key={product.id}>
              <label htmlFor={inputId} className="agents-page__bindings-option">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={selectedIds.includes(product.id)}
                  onChange={() => toggleProduct(product.id)}
                />
                <span>
                  {product.title}{" "}
                  <span className="agents-page__bindings-status">({product.status})</span>
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
  bound_product_ids: string[];
}

interface AgentCreateFormProps {
  applicationId: string;
  bindableProducts: PublishedDataProductResponse[];
  onCreated: () => void;
  onCancel?: () => void;
}

function AgentCreateForm({
  applicationId,
  bindableProducts,
  onCreated,
  onCancel,
}: AgentCreateFormProps) {
  const [fields, setFields] = useState<CreateFormFields>({
    title: "",
    description: "",
    created_by: "",
    bound_product_ids: [],
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
      await createAgent({
        application_id: applicationId,
        title: trimmedTitle,
        agent_definition: {},
        ...(description ? { description } : {}),
        ...(createdBy ? { created_by: createdBy } : {}),
        ...(fields.bound_product_ids.length > 0
          ? { bound_product_ids: fields.bound_product_ids }
          : {}),
      });
      onCreated();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create agent";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="agents-page__form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Create agent"
    >
      <div className="agents-page__field">
        <label htmlFor="agent-title">Title</label>
        <input
          id="agent-title"
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
          aria-describedby={titleError ? "agent-title-error" : undefined}
        />
        {titleError && (
          <p id="agent-title-error" className="agents-page__field-error" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="agents-page__field">
        <label htmlFor="agent-description">
          Description <span className="agents-page__optional">(optional)</span>
        </label>
        <textarea
          id="agent-description"
          name="description"
          rows={3}
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>

      <div className="agents-page__field">
        <label htmlFor="agent-created-by">
          Created by <span className="agents-page__optional">(optional)</span>
        </label>
        <input
          id="agent-created-by"
          name="created_by"
          type="text"
          value={fields.created_by}
          onChange={(event) =>
            setFields((current) => ({ ...current, created_by: event.target.value }))
          }
        />
      </div>

      <ProductBindingsField
        idPrefix="agent-create"
        products={bindableProducts}
        selectedIds={fields.bound_product_ids}
        onChange={(bound_product_ids) =>
          setFields((current) => ({ ...current, bound_product_ids }))
        }
        disabled={submitting}
      />

      {submitError && (
        <div className="agents-page__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="agents-page__form-actions">
        {onCancel && (
          <button
            type="button"
            className="agents-page__button agents-page__button--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="agents-page__button agents-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create agent"}
        </button>
      </div>
    </form>
  );
}

interface AgentBindingsDialogProps {
  agent: AgentDefinitionResponse;
  bindableProducts: PublishedDataProductResponse[];
  onClose: () => void;
  onSaved: () => void;
}

function AgentBindingsDialog({
  agent,
  bindableProducts,
  onClose,
  onSaved,
}: AgentBindingsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(agent.bound_product_ids);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await updateAgent(agent.id, { bound_product_ids: selectedIds });
      onSaved();
      onClose();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update agent bindings";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      className="agents-page__dialog"
      open
      aria-labelledby={`bindings-dialog-title-${agent.id}`}
    >
      <div className="agents-page__dialog-panel">
        <h3 id={`bindings-dialog-title-${agent.id}`} className="agents-page__dialog-title">
          Edit bindings — {agent.title}
        </h3>
        <p className="agents-page__dialog-lead">
          Select Published or Versioned data products for this agent (D-003).
        </p>
        <ProductBindingsField
          idPrefix={`bindings-${agent.id}`}
          products={bindableProducts}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          disabled={submitting}
        />
        {submitError && (
          <div className="agents-page__error" role="alert">
            {submitError}
          </div>
        )}
        <div className="agents-page__form-actions">
          <button
            type="button"
            className="agents-page__button agents-page__button--secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="agents-page__button agents-page__button--primary"
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

interface AgentsPageProps {
  applicationId: string;
}

export function AgentsPage({ applicationId }: AgentsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [bindableProducts, setBindableProducts] = useState<PublishedDataProductResponse[]>([]);
  const [allProducts, setAllProducts] = useState<PublishedDataProductResponse[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentDefinitionResponse | null>(null);

  const productTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of allProducts) {
      map.set(product.id, product.title);
    }
    return map;
  }, [allProducts]);

  const loadProducts = useCallback(() => {
    return listProducts(applicationId)
      .then((products) => {
        setAllProducts(products);
        setBindableProducts(products.filter(isConsumableProduct));
        return products;
      })
      .catch(() => {
        setAllProducts([]);
        setBindableProducts([]);
      });
  }, [applicationId]);

  const loadAgents = useCallback(() => {
    setState({ kind: "loading" });

    return listAgents(applicationId)
      .then((agents) => {
        setState({ kind: "success", agents });
        return agents;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load agents";
        setState({ kind: "error", message });
        throw error;
      });
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;

    void loadProducts();

    listAgents(applicationId)
      .then((agents) => {
        if (!cancelled) {
          setState({ kind: "success", agents });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load agents";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, loadProducts]);

  function handleCreated() {
    setShowCreateForm(false);
    void loadAgents();
    void loadProducts();
  }

  function handleBindingsSaved() {
    void loadAgents();
  }

  async function handleStatusTransition(agentId: string, nextStatus: AgentDefinitionStatus) {
    setActionError(null);
    setPendingAgentId(agentId);
    try {
      await updateAgentStatus(agentId, nextStatus);
      await loadAgents();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update agent status";
      setActionError(message);
    } finally {
      setPendingAgentId(null);
    }
  }

  async function handleForkVersion(agentId: string) {
    setActionError(null);
    setPendingAgentId(agentId);
    try {
      await forkAgentVersion(agentId);
      await loadAgents();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create agent version";
      setActionError(message);
    } finally {
      setPendingAgentId(null);
    }
  }

  const isEmpty = state.kind === "success" && state.agents.length === 0;
  const hasAgents = state.kind === "success" && state.agents.length > 0;

  return (
    <section className="agents-page" aria-labelledby="agents-heading">
      <div className="agents-page__header">
        <div>
          <h2 id="agents-heading">Agents</h2>
          <p className="agents-page__lead">
            Agent definitions bind to published data products and drive runtime
            execution in the semantic intelligence lifecycle.
          </p>
        </div>
        {hasAgents && !showCreateForm && (
          <button
            type="button"
            className="agents-page__button agents-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New agent
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p className="agents-page__status" role="status" aria-live="polite">
          Loading agents…
        </p>
      )}

      {state.kind === "error" && (
        <div className="agents-page__error" role="alert">
          {state.message}
        </div>
      )}

      {actionError && (
        <div className="agents-page__error agents-page__action-error" role="alert">
          {actionError}
        </div>
      )}

      {isEmpty && (
        <div className="agents-page__empty" role="status">
          <p>No agent definitions yet.</p>
          <p className="agents-page__hint">
            Create your first agent definition to get started.
          </p>
          <AgentCreateForm
            applicationId={applicationId}
            bindableProducts={bindableProducts}
            onCreated={handleCreated}
          />
        </div>
      )}

      {hasAgents && showCreateForm && (
        <div className="agents-page__create-panel">
          <h3 className="agents-page__create-title">New agent</h3>
          <AgentCreateForm
            applicationId={applicationId}
            bindableProducts={bindableProducts}
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {editingAgent && (
        <AgentBindingsDialog
          agent={editingAgent}
          bindableProducts={bindableProducts}
          onClose={() => setEditingAgent(null)}
          onSaved={handleBindingsSaved}
        />
      )}

      {hasAgents && (
        <div className="agents-page__table-wrap">
          <table className="agents-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Bound products</th>
                <th scope="col">Version</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.agents.map((agent) => (
                <tr key={agent.id}>
                  <td>{agent.title}</td>
                  <td>
                    <span className={statusClassName(agent.status)}>{agent.status}</span>
                  </td>
                  <td className="agents-table__bindings">
                    {formatBoundProducts(agent, productTitleById)}
                  </td>
                  <td>{formatVersionChain(agent, state.agents)}</td>
                  <td>{formatDate(agent.created_at)}</td>
                  <td>
                    <div className="agents-table__actions">
                      {canEditBindings(agent.status) && (
                        <button
                          type="button"
                          className="agents-page__button agents-page__button--secondary agents-table__action"
                          disabled={pendingAgentId === agent.id}
                          onClick={() => setEditingAgent(agent)}
                        >
                          Edit bindings
                        </button>
                      )}
                      {canForkAgent(agent) && (
                        <button
                          type="button"
                          className="agents-page__button agents-page__button--secondary agents-table__action"
                          disabled={pendingAgentId === agent.id}
                          onClick={() => void handleForkVersion(agent.id)}
                        >
                          New version
                        </button>
                      )}
                      {getNextAgentStatuses(agent.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          className="agents-page__button agents-page__button--secondary agents-table__action"
                          disabled={pendingAgentId === agent.id}
                          onClick={() => void handleStatusTransition(agent.id, nextStatus)}
                        >
                          {getAgentStatusActionLabel(nextStatus)}
                        </button>
                      ))}
                      {getNextAgentStatuses(agent.status).length === 0 &&
                        !canEditBindings(agent.status) &&
                        !canForkAgent(agent) && (
                          <span className="agents-table__no-actions">—</span>
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
