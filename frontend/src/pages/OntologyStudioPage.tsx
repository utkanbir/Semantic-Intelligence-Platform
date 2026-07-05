import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { importOntology } from "../api/ontologies";
import {
  listConnectors,
  CONNECTOR_TYPE_LABELS,
  type ConnectorResponse,
} from "../api/adapters";
import { getVendorLabel, readConnectorVendor } from "../connectors/catalog";

interface OntologyStudioPageProps {
  applicationId: string;
}

type WizardMode = "create" | "import";
type ImportSourceMethod = "file" | "paste";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; connectors: ConnectorResponse[] }
  | {
      kind: "imported";
      ontologyId: string;
      artifactUri: string | null | undefined;
      semanticTransactionId: string | null | undefined;
      title: string;
      mode: WizardMode;
    };

const WIZARD_STEPS = ["Source", "Connector & metadata", "Review & run"] as const;
const PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

function formatConnectorLabel(connector: ConnectorResponse): string {
  const vendorId = readConnectorVendor(connector.connector_configuration);
  const vendorLabel = vendorId
    ? getVendorLabel(connector.connector_type, vendorId)
    : null;

  return vendorLabel ? `${connector.title} — ${vendorLabel}` : connector.title;
}

function normalizePrefix(prefix: string): string {
  return prefix.trim().replace(/:$/, "");
}

function inferSourceFormat(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "ttl":
      return "ttl";
    case "rdf":
      return "rdf";
    case "owl":
      return "owl";
    case "xml":
      return "xml";
    case "jsonld":
      return "jsonld";
    default:
      return "ttl";
  }
}

function escapeTurtleLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n");
}

function buildMinimalOntologyDocument(values: {
  title: string;
  namespaceIri: string;
  prefix: string;
  description: string;
}): string {
  const metadataLines = [`  rdfs:label "${escapeTurtleLiteral(values.title)}"`];
  if (values.description) {
    metadataLines.push(`  rdfs:comment "${escapeTurtleLiteral(values.description)}"`);
  }

  return [
    "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    `@prefix ${values.prefix}: <${values.namespaceIri}> .`,
    "",
    `<${values.namespaceIri}> a owl:Ontology ;`,
    ...metadataLines.map((line, index) =>
      index === metadataLines.length - 1 ? `${line} .` : `${line} ;`,
    ),
  ].join("\n");
}

function previewSourceContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 1400) {
    return trimmed;
  }

  return `${trimmed.slice(0, 1400)}\n\n…`;
}

function readUploadedFile(file: File): Promise<string> {
  const readWithFileReader = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });

  if (typeof file.text === "function") {
    try {
      return file.text().catch(() => readWithFileReader());
    } catch {
      return readWithFileReader();
    }
  }

  return readWithFileReader();
}

export function OntologyStudioPage({ applicationId }: OntologyStudioPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<WizardMode | null>(null);
  const [title, setTitle] = useState("");
  const [namespaceIri, setNamespaceIri] = useState("");
  const [prefix, setPrefix] = useState("");
  const [description, setDescription] = useState("");
  const [sourceMethod, setSourceMethod] = useState<ImportSourceMethod>("file");
  const [sourceFileName, setSourceFileName] = useState("");
  const [connectorId, setConnectorId] = useState("");
  const [sourceFormat, setSourceFormat] = useState("ttl");
  const [sourceContent, setSourceContent] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listConnectors({
      connectorType: "ontology_knowledge_graph",
      status: "Active",
    })
      .then((connectors) => {
        if (!cancelled) {
          setState({ kind: "ready", connectors });
          if (connectors.length > 0) {
            setConnectorId(connectors[0].id);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load connectors";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedPrefix = normalizePrefix(prefix);
  const generatedSourceContent = useMemo(() => {
    if (mode !== "create") {
      return "";
    }

    return buildMinimalOntologyDocument({
      title: title.trim(),
      namespaceIri: namespaceIri.trim(),
      prefix: normalizedPrefix,
      description: description.trim(),
    });
  }, [description, mode, namespaceIri, normalizedPrefix, title]);

  const contentForSubmission = mode === "create" ? generatedSourceContent : sourceContent.trim();
  const effectiveSourceFormat = mode === "create" ? "ttl" : sourceFormat.trim() || "ttl";

  function validateStep(nextStep: number): string | null {
    if (nextStep === 0) {
      if (!mode) {
        return "Choose whether you want to create a new ontology or import an existing one";
      }

      if (!title.trim()) {
        return "Title is required";
      }

      if (mode === "create") {
        if (!namespaceIri.trim()) {
          return "Namespace / base IRI is required";
        }

        if (!normalizedPrefix) {
          return "Prefix is required";
        }

        if (!PREFIX_PATTERN.test(normalizedPrefix)) {
          return "Prefix must start with a letter and use only letters, numbers, underscores, or hyphens";
        }
      }

      if (mode === "import" && !sourceContent.trim()) {
        return sourceMethod === "file"
          ? "Upload an ontology file to continue"
          : "Paste ontology content to continue";
      }
    }

    if (nextStep === 1) {
      if (!connectorId) {
        return "Connector is required";
      }

      if (mode === "import" && !sourceFormat.trim()) {
        return "Source format is required";
      }
    }

    return null;
  }

  function handleModeChange(nextMode: WizardMode) {
    setMode(nextMode);
    setStepError(null);
    setSubmitError(null);

    if (nextMode === "create") {
      setSourceFormat("ttl");
    }
  }

  function handleNext() {
    const message = validateStep(step);
    if (message) {
      setStepError(message);
      return;
    }

    setStepError(null);
    setStep((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
  }

  function handleBack() {
    setStepError(null);
    setSubmitError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reviewValidation = validateStep(1);
    if (reviewValidation) {
      setStepError(reviewValidation);
      return;
    }

    setStepError(null);
    setSubmitError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !connectorId || !contentForSubmission) {
      setSubmitError("Complete the wizard before running the import");
      return;
    }

    setSubmitting(true);
    try {
      const createdByValue = createdBy.trim();
      const descriptionValue = description.trim();
      const ontology = await importOntology({
        application_id: applicationId,
        title: trimmedTitle,
        connector_id: connectorId,
        source_format: effectiveSourceFormat,
        source_content: contentForSubmission,
        ...(createdByValue ? { created_by: createdByValue } : {}),
        ...(descriptionValue ? { description: descriptionValue } : {}),
      });
      setState({
        kind: "imported",
        ontologyId: ontology.id,
        artifactUri: ontology.artifact_uri,
        semanticTransactionId: ontology.semantic_transaction_id ?? null,
        title: ontology.title,
        mode: mode ?? "import",
      });
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to import ontology";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await readUploadedFile(file);
      setSourceMethod("file");
      setSourceFileName(file.name);
      setSourceContent(text);
      setSourceFormat(inferSourceFormat(file.name));
      setStepError(null);
      setSubmitError(null);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, ""));
      }
    } catch {
      setSubmitError("Failed to read the selected file");
    }
  }

  if (state.kind === "loading") {
    return (
      <p className="agent-runs-page__status" role="status">
        Loading Ontology Wizard…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="agent-runs-page__error" role="alert">
        {state.message}
      </div>
    );
  }

  if (state.kind === "imported") {
    return (
      <section className="agent-runs-page" aria-labelledby="ontology-studio-heading">
        <h2 id="ontology-studio-heading">Ontology Wizard</h2>
        <div className="agent-runs-page__empty" role="status">
          <p>
            {state.mode === "create"
              ? "Ontology created successfully."
              : "Ontology imported successfully."}
          </p>
          <p>
            <strong>{state.title}</strong> is now available through the ontology workspace.
          </p>
          {state.artifactUri && (
            <p>
              Artifact URI: <code>{state.artifactUri}</code>
            </p>
          )}
          <p>
            <Link to={`/applications/${applicationId}/ontology#ontology-${state.ontologyId}`}>
              View created ontology
            </Link>
            {state.semanticTransactionId && (
              <>
                {" · "}
                <Link
                  to={`/applications/${applicationId}/semantic-transactions/${state.semanticTransactionId}`}
                >
                  View semantic transaction
                </Link>
              </>
            )}
            {!state.semanticTransactionId && (
              <>
                {" · "}
                <Link to={`/applications/${applicationId}/semantic-transactions`}>
                  View semantic transactions
                </Link>
              </>
            )}
          </p>
        </div>
      </section>
    );
  }

  const { connectors } = state;
  const selectedConnector =
    connectors.find((connector) => connector.id === connectorId) ?? connectors[0] ?? null;
  const sourcePreview = previewSourceContent(contentForSubmission);

  return (
    <section className="agent-runs-page" aria-labelledby="ontology-studio-heading">
      <div className="agent-runs-page__header">
        <div>
          <h2 id="ontology-studio-heading">Ontology Wizard</h2>
          <p className="agent-runs-page__lead">
            Choose whether to create a minimal ontology from metadata or import existing
            RDF content. The wizard then guides you through connector selection, metadata,
            and a final review before running the existing ontology import flow.
          </p>
        </div>
      </div>

      {connectors.length === 0 ? (
        <div className="agent-runs-page__empty" role="status">
          <p>
            No active ontology / knowledge graph connectors. Create one under Platform →
            Connectors, activate it, then return here to run the ontology wizard.
          </p>
          <p className="agent-runs-page__hint">
            <Link to="/connectors">Open connectors</Link>
          </p>
        </div>
      ) : (
        <form
          className="agent-runs-page__form ontology-wizard"
          onSubmit={(event) => void handleSubmit(event)}
          aria-label="Ontology wizard"
        >
          <ol className="ontology-wizard__steps" aria-label="Wizard steps">
            {WIZARD_STEPS.map((label, index) => {
              const stateLabel =
                index === step ? "current" : index < step ? "complete" : "upcoming";

              return (
                <li
                  key={label}
                  className={`ontology-wizard__step ontology-wizard__step--${stateLabel}`}
                >
                  <span className="ontology-wizard__step-number">{index + 1}</span>
                  <div>
                    <p className="ontology-wizard__step-label">{label}</p>
                    <p className="ontology-wizard__step-state">{stateLabel}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          {step === 0 && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">Step 1 · Source</h3>
              <div className="ontology-wizard__mode-grid" role="radiogroup" aria-label="Mode">
                <label className="ontology-wizard__mode-card">
                  <input
                    type="radio"
                    name="ontology-mode"
                    value="create"
                    checked={mode === "create"}
                    onChange={() => handleModeChange("create")}
                  />
                  <span className="ontology-wizard__mode-title">Create from scratch</span>
                  <span className="ontology-wizard__mode-copy">
                    Start with title, namespace, and prefix. The wizard will generate a
                    minimal ontology document for you.
                  </span>
                </label>
                <label className="ontology-wizard__mode-card">
                  <input
                    type="radio"
                    name="ontology-mode"
                    value="import"
                    checked={mode === "import"}
                    onChange={() => handleModeChange("import")}
                  />
                  <span className="ontology-wizard__mode-title">Import existing</span>
                  <span className="ontology-wizard__mode-copy">
                    Bring in an existing ontology from a file upload or pasted RDF content.
                  </span>
                </label>
              </div>

              {mode && (
                <div className="ontology-wizard__step-body">
                  <div className="agent-runs-page__field">
                    <label htmlFor="ontology-title">Title</label>
                    <input
                      id="ontology-title"
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value);
                        setStepError(null);
                      }}
                    />
                  </div>

                  {mode === "create" ? (
                    <>
                      <div className="agent-runs-page__field">
                        <label htmlFor="ontology-namespace">Namespace / base IRI</label>
                        <input
                          id="ontology-namespace"
                          placeholder="https://example.com/ontology#"
                          value={namespaceIri}
                          onChange={(event) => {
                            setNamespaceIri(event.target.value);
                            setStepError(null);
                          }}
                        />
                      </div>
                      <div className="agent-runs-page__field">
                        <label htmlFor="ontology-prefix">Prefix</label>
                        <input
                          id="ontology-prefix"
                          placeholder="ex"
                          value={prefix}
                          onChange={(event) => {
                            setPrefix(event.target.value);
                            setStepError(null);
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <fieldset className="ontology-wizard__source-options">
                        <legend>Import source</legend>
                        <label>
                          <input
                            type="radio"
                            name="ontology-source-method"
                            value="file"
                            checked={sourceMethod === "file"}
                            onChange={() => {
                              setSourceMethod("file");
                              setStepError(null);
                            }}
                          />
                          <span>Upload file</span>
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="ontology-source-method"
                            value="paste"
                            checked={sourceMethod === "paste"}
                            onChange={() => {
                              setSourceMethod("paste");
                              setStepError(null);
                            }}
                          />
                          <span>Paste text</span>
                        </label>
                      </fieldset>

                      {sourceMethod === "file" ? (
                        <div className="agent-runs-page__field">
                          <label htmlFor="ontology-import-file">Ontology file</label>
                          <input
                            id="ontology-import-file"
                            type="file"
                            accept=".owl,.xml,.ttl,.rdf,.jsonld,text/plain,application/xml"
                            onChange={(event) => void handleFileChange(event)}
                          />
                          <p className="agent-runs-page__field-hint">
                            {sourceFileName
                              ? `Loaded ${sourceFileName}`
                              : "Accepted formats include TTL, RDF/XML, OWL, and JSON-LD."}
                          </p>
                        </div>
                      ) : (
                        <div className="agent-runs-page__field">
                          <label htmlFor="ontology-import-content">Ontology content</label>
                          <textarea
                            id="ontology-import-content"
                            rows={12}
                            value={sourceContent}
                            onChange={(event) => {
                              setSourceContent(event.target.value);
                              setStepError(null);
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">Step 2 · Connector & metadata</h3>
              <div className="ontology-wizard__step-body">
                <div className="agent-runs-page__field">
                  <label htmlFor="ontology-import-connector">Connector</label>
                  <select
                    id="ontology-import-connector"
                    value={connectorId}
                    onChange={(event) => {
                      setConnectorId(event.target.value);
                      setStepError(null);
                    }}
                  >
                    {connectors.map((connector) => (
                      <option key={connector.id} value={connector.id}>
                        {formatConnectorLabel(connector)} (
                        {CONNECTOR_TYPE_LABELS[connector.connector_type]})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="agent-runs-page__field">
                  <label htmlFor="ontology-import-format">Source format</label>
                  <input
                    id="ontology-import-format"
                    value={effectiveSourceFormat}
                    disabled={mode === "create"}
                    onChange={(event) => {
                      setSourceFormat(event.target.value);
                      setStepError(null);
                    }}
                  />
                  <p className="agent-runs-page__field-hint">
                    {mode === "create"
                      ? "The wizard generates Turtle and submits it through the import pipeline."
                      : "Adjust this if the pasted or uploaded content uses a different RDF serialization."}
                  </p>
                </div>
                <div className="agent-runs-page__field">
                  <label htmlFor="ontology-import-description">
                    Description <span className="agent-runs-page__optional">(optional)</span>
                  </label>
                  <textarea
                    id="ontology-import-description"
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
                <div className="agent-runs-page__field">
                  <label htmlFor="ontology-import-created-by">
                    Created by <span className="agent-runs-page__optional">(optional)</span>
                  </label>
                  <input
                    id="ontology-import-created-by"
                    value={createdBy}
                    onChange={(event) => setCreatedBy(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">Step 3 · Review & run</h3>
              <div className="ontology-wizard__review-grid">
                <div className="ontology-wizard__review-card">
                  <h4>Summary</h4>
                  <dl className="ontology-wizard__review-list">
                    <div>
                      <dt>Mode</dt>
                      <dd>{mode === "create" ? "Create from scratch" : "Import existing"}</dd>
                    </div>
                    <div>
                      <dt>Title</dt>
                      <dd>{title.trim()}</dd>
                    </div>
                    {mode === "create" && (
                      <>
                        <div>
                          <dt>Namespace / base IRI</dt>
                          <dd>
                            <code>{namespaceIri.trim()}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Prefix</dt>
                          <dd>{normalizedPrefix}</dd>
                        </div>
                      </>
                    )}
                    {mode === "import" && (
                      <div>
                        <dt>Import source</dt>
                        <dd>{sourceMethod === "file" ? sourceFileName || "Uploaded file" : "Pasted text"}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Connector</dt>
                      <dd>{selectedConnector ? formatConnectorLabel(selectedConnector) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Source format</dt>
                      <dd>{effectiveSourceFormat}</dd>
                    </div>
                    {description.trim() && (
                      <div>
                        <dt>Description</dt>
                        <dd>{description.trim()}</dd>
                      </div>
                    )}
                    {createdBy.trim() && (
                      <div>
                        <dt>Created by</dt>
                        <dd>{createdBy.trim()}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="ontology-wizard__review-card">
                  <h4>Submitted artifact preview</h4>
                  <pre className="ontology-wizard__source-preview">{sourcePreview}</pre>
                </div>
              </div>
            </div>
          )}

          {(stepError || submitError) && (
            <div className="agent-runs-page__error" role="alert">
              {stepError ?? submitError}
            </div>
          )}

          <div className="platform-page__form-actions">
            {step > 0 && (
              <button type="button" onClick={handleBack} disabled={submitting}>
                Back
              </button>
            )}
            {step < WIZARD_STEPS.length - 1 ? (
              <button type="button" onClick={handleNext}>
                Next
              </button>
            ) : (
              <button type="submit" disabled={submitting}>
                {submitting
                  ? mode === "create"
                    ? "Creating…"
                    : "Importing…"
                  : mode === "create"
                    ? "Create ontology"
                    : "Import ontology"}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
