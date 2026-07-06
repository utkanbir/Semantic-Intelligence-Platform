import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api";
import { importOntology, validateOntologyContent, type OntologyValidationReport } from "../api/ontologies";
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
type WizardPhase = "mode" | "edit" | "connector" | "review";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      activeConnectors: ConnectorResponse[];
    }
  | {
      kind: "imported";
      ontologyId: string;
      artifactUri: string | null | undefined;
      semanticTransactionId: string | null | undefined;
      title: string;
      mode: WizardMode;
      connectorLabel: string;
    };

const FULL_WIZARD_STEPS = ["Mode", "Edit & validate", "Connector", "Review & run"] as const;
const FOCUSED_WIZARD_STEPS = ["Edit & validate", "Connector", "Review & run"] as const;
const SEMANTIC_TRANSACTION_STEPS = [
  "validate_request",
  "resolve_connector",
  "persist_artifact",
  "persist_metadata",
  "finalize",
] as const;
const PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

function listActiveOntologyConnectors(connectors: ConnectorResponse[]): ConnectorResponse[] {
  return connectors.filter((connector) => connector.status === "Active");
}

function formatConnectorLabel(connector: ConnectorResponse): string {
  const vendorId = readConnectorVendor(connector.connector_configuration);
  const vendorLabel = vendorId
    ? getVendorLabel(connector.connector_type, vendorId)
    : null;

  return vendorLabel ? `${connector.title} — ${vendorLabel}` : connector.title;
}

function formatModeLabel(mode: WizardMode): string {
  return mode === "create" ? "Manual" : "OWL Import";
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

function inferSourceFormatFromContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<rdf:RDF")) {
    return "rdf";
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "jsonld";
  }
  if (trimmed.startsWith("@prefix") || trimmed.startsWith("PREFIX ")) {
    return "ttl";
  }
  return null;
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

function hasBasicRdfStructure(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  return (
    normalized.includes("@prefix") ||
    normalized.includes("owl:ontology") ||
    normalized.includes("<rdf:rdf") ||
    normalized.includes("rdf:rdf")
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function phaseForStep(step: number, skipModeStep: boolean): WizardPhase {
  if (skipModeStep) {
    if (step === 0) {
      return "edit";
    }
    if (step === 1) {
      return "connector";
    }
    return "review";
  }

  if (step === 0) {
    return "mode";
  }
  if (step === 1) {
    return "edit";
  }
  if (step === 2) {
    return "connector";
  }
  return "review";
}

interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
}

function ValidationChecklist({ checks }: { checks: ValidationCheck[] }) {
  return (
    <ul className="ontology-wizard__validation-checklist" aria-label="Validation checks">
      {checks.map((check) => (
        <li
          key={check.id}
          className={`ontology-wizard__validation-item${
            check.passed ? " ontology-wizard__validation-item--passed" : ""
          }`}
        >
          <span className="ontology-wizard__validation-marker" aria-hidden="true">
            {check.passed ? "✓" : "○"}
          </span>
          {check.label}
        </li>
      ))}
    </ul>
  );
}

export function OntologyStudioPage({ applicationId }: OntologyStudioPageProps) {
  const [searchParams] = useSearchParams();
  const initialMode = useMemo((): WizardMode | null => {
    const modeParam = searchParams.get("mode")?.toLowerCase();
    if (modeParam === "manual" || modeParam === "create") {
      return "create";
    }
    if (modeParam === "import") {
      return "import";
    }
    return null;
  }, [searchParams]);
  const skipModeStep = initialMode !== null;

  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<WizardMode | null>(initialMode);
  const [title, setTitle] = useState("");
  const [namespaceIri, setNamespaceIri] = useState("");
  const [prefix, setPrefix] = useState("");
  const [description, setDescription] = useState("");
  const [sourceMethod, setSourceMethod] = useState<ImportSourceMethod>("file");
  const [sourceFileName, setSourceFileName] = useState("");
  const [sourceFileSize, setSourceFileSize] = useState<number | null>(null);
  const [connectorId, setConnectorId] = useState("");
  const [sourceFormat, setSourceFormat] = useState("ttl");
  const [sourceContent, setSourceContent] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [backendValidationReport, setBackendValidationReport] =
    useState<OntologyValidationReport | null>(null);

  const visibleSteps = skipModeStep ? FOCUSED_WIZARD_STEPS : FULL_WIZARD_STEPS;
  const currentPhase = phaseForStep(step, skipModeStep);
  const pageTitle = mode
    ? `Create ontology · ${formatModeLabel(mode)}`
    : "Create ontology";

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      setStep(0);
    }
  }, [initialMode]);

  useEffect(() => {
    let cancelled = false;

    listConnectors({
      connectorType: "ontology_knowledge_graph",
    })
      .then((connectors) => {
        if (!cancelled) {
          const activeConnectors = listActiveOntologyConnectors(connectors);
          setState({ kind: "ready", activeConnectors });
          if (activeConnectors.length > 0) {
            setConnectorId(activeConnectors[0].id);
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

  const manualValidationChecks = useMemo((): ValidationCheck[] => {
    if (mode !== "create") {
      return [];
    }

    return [
      { id: "title", label: "Title provided", passed: Boolean(title.trim()) },
      {
        id: "namespace",
        label: "Namespace / base IRI provided",
        passed: Boolean(namespaceIri.trim()),
      },
      { id: "prefix", label: "Prefix provided", passed: Boolean(normalizedPrefix) },
      {
        id: "prefix-pattern",
        label: "Prefix uses valid characters",
        passed: !normalizedPrefix || PREFIX_PATTERN.test(normalizedPrefix),
      },
      {
        id: "document",
        label: "Generated ontology document is non-empty",
        passed: Boolean(generatedSourceContent.trim()),
      },
    ];
  }, [generatedSourceContent, mode, namespaceIri, normalizedPrefix, title]);

  const importValidationChecks = useMemo((): ValidationCheck[] => {
    if (mode !== "import") {
      return [];
    }

    const trimmedContent = sourceContent.trim();

    return [
      { id: "title", label: "Title provided", passed: Boolean(title.trim()) },
      {
        id: "source",
        label:
          sourceMethod === "file"
            ? "Ontology file uploaded"
            : "Ontology content pasted",
        passed: Boolean(trimmedContent),
      },
      {
        id: "format",
        label: "Source format selected",
        passed: Boolean(sourceFormat.trim()),
      },
      {
        id: "rdf-structure",
        label: "Basic RDF structure detected",
        passed: !trimmedContent || hasBasicRdfStructure(trimmedContent),
      },
    ];
  }, [mode, sourceContent, sourceFormat, sourceMethod, title]);

  const editStepValid =
    mode !== null &&
    (mode === "create"
      ? manualValidationChecks.every((check) => check.passed)
      : importValidationChecks.every((check) => check.passed));

  const backendValidationBlocking =
    backendValidationReport !== null && backendValidationReport.error_count > 0;

  async function runBackendValidation(): Promise<OntologyValidationReport | null> {
    if (!contentForSubmission) {
      return null;
    }

    setValidationLoading(true);
    try {
      const report = await validateOntologyContent({
        source_format: effectiveSourceFormat,
        source_content: contentForSubmission,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        application_id: applicationId,
      });
      setBackendValidationReport(report);
      return report;
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to validate ontology content";
      setStepError(message);
      return null;
    } finally {
      setValidationLoading(false);
    }
  }

  function validatePhase(phase: WizardPhase): string | null {
    if (phase === "mode") {
      if (!mode) {
        return "Choose Manual or OWL Import to continue";
      }
    }

    if (phase === "edit") {
      if (!mode) {
        return "Choose Manual or OWL Import to continue";
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

        if (!generatedSourceContent.trim()) {
          return "Generated ontology content is empty";
        }
      }

      if (mode === "import" && !sourceContent.trim()) {
        return sourceMethod === "file"
          ? "Upload an ontology file to continue"
          : "Paste ontology content to continue";
      }
    }

    if (phase === "connector") {
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

  async function handleNext() {
    const message = validatePhase(currentPhase);
    if (message) {
      setStepError(message);
      return;
    }

    if (currentPhase === "connector") {
      const report = await runBackendValidation();
      if (!report) {
        return;
      }
      if (report.error_count > 0) {
        setStepError(
          "Resolve validation errors before continuing to review and materialize",
        );
        return;
      }
    }

    setStepError(null);
    setStep((current) => Math.min(current + 1, visibleSteps.length - 1));
  }

  function handleBack() {
    setStepError(null);
    setSubmitError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reviewValidation = validatePhase("connector");
    if (reviewValidation) {
      setStepError(reviewValidation);
      return;
    }

    setStepError(null);
    setSubmitError(null);

    const report = await runBackendValidation();
    if (!report) {
      return;
    }
    if (report.error_count > 0) {
      setSubmitError("Resolve validation errors before materializing the ontology");
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !connectorId || !contentForSubmission) {
      setSubmitError("Complete the flow before materializing the ontology");
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
      const connector =
        state.kind === "ready"
          ? state.activeConnectors.find((item) => item.id === connectorId)
          : undefined;
      setState({
        kind: "imported",
        ontologyId: ontology.id,
        artifactUri: ontology.artifact_uri,
        semanticTransactionId: ontology.semantic_transaction_id ?? null,
        title: ontology.title,
        mode: mode ?? "import",
        connectorLabel: connector ? formatConnectorLabel(connector) : "Selected connector",
      });
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to materialize ontology";
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
      setSourceFileSize(file.size);
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

  const backHref = `/applications/${applicationId}/ontology`;

  if (state.kind === "loading") {
    return (
      <p className="agent-runs-page__status" role="status">
        Loading ontology creation flow…
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
      <section className="agent-runs-page" aria-labelledby="ontology-create-heading">
        <Link to={backHref} className="agent-run-detail__back">
          ← Back to ontologies
        </Link>
        <h2 id="ontology-create-heading">{pageTitle}</h2>

        <article className="ontology-wizard__completion-card" role="status">
          <p className="ontology-wizard__completion-status">
            {state.mode === "create"
              ? "Ontology materialized successfully"
              : "Ontology imported successfully"}
          </p>

          <dl className="ontology-wizard__completion-meta">
            <div>
              <dt>Title</dt>
              <dd>{state.title}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Draft · v1</dd>
            </div>
            <div>
              <dt>Connector</dt>
              <dd>{state.connectorLabel}</dd>
            </div>
            {state.artifactUri && (
              <div>
                <dt>Artifact URI</dt>
                <dd>
                  <code>{state.artifactUri}</code>
                </dd>
              </div>
            )}
          </dl>

          <section className="ontology-wizard__completion-semantic" aria-labelledby="semantic-tx-heading">
            <h3 id="semantic-tx-heading">Semantic transaction</h3>
            {state.semanticTransactionId ? (
              <>
                <p className="ontology-wizard__completion-copy">
                  Recorded as <code>ontology.imported</code> with orchestrated trace steps.
                </p>
                <p>
                  <Link
                    to={`/applications/${applicationId}/semantic-transactions/${state.semanticTransactionId}`}
                    className="ontologies-page__button ontologies-page__button--primary"
                  >
                    View semantic transaction
                  </Link>
                </p>
                <ul className="ontology-wizard__completion-steps">
                  {SEMANTIC_TRANSACTION_STEPS.map((stepName) => (
                    <li key={stepName}>{stepName}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="agent-runs-page__error" role="alert">
                Ontology was materialized but no semantic transaction id was returned. Check
                semantic transactions for the latest ontology lineage entry.
              </p>
            )}
          </section>

          <p className="ontology-wizard__completion-links">
            <Link to={`/applications/${applicationId}/ontology#ontology-${state.ontologyId}`}>
              View ontology
            </Link>
            {!state.semanticTransactionId && (
              <>
                {" · "}
                <Link to={`/applications/${applicationId}/semantic-transactions`}>
                  Open semantic transactions
                </Link>
              </>
            )}
          </p>
        </article>
      </section>
    );
  }

  const { activeConnectors } = state;
  const selectedConnector =
    activeConnectors.find((connector) => connector.id === connectorId) ??
    activeConnectors[0] ??
    null;
  const sourcePreview = previewSourceContent(contentForSubmission);
  const stepNumber = step + 1;
  const hasActiveConnectors = activeConnectors.length > 0;

  return (
    <section className="agent-runs-page" aria-labelledby="ontology-create-heading">
      <div className="agent-runs-page__header">
        <div>
          <Link to={backHref} className="agent-run-detail__back">
            ← Back to ontologies
          </Link>
          <h2 id="ontology-create-heading">{pageTitle}</h2>
          <p className="agent-runs-page__lead">
            {mode === "create"
              ? "Define business meaning from scratch. A minimal ontology document is generated, validated, and materialized through your connector."
              : mode === "import"
                ? "Import existing OWL/RDF semantics. Content is validated client-side, then materialized through the connector framework."
                : "Capture business meaning for this application. Choose Manual or OWL Import to continue."}
          </p>
        </div>
      </div>

      {!hasActiveConnectors ? (
        <div className="agent-runs-page__empty" role="status">
          <p>
            No ontology / knowledge graph connector is ready yet. Create one under Platform →
            Connectors, test the connection, and save it — then return here to create an ontology.
          </p>
          <p className="agent-runs-page__hint">
            <Link to="/connectors">Open connectors</Link>
          </p>
        </div>
      ) : (
        <form
          className="agent-runs-page__form ontology-wizard"
          onSubmit={(event) => void handleSubmit(event)}
          aria-label="Create ontology"
        >
          <ol className="ontology-wizard__steps" aria-label="Creation steps">
            {visibleSteps.map((label, index) => {
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

          {currentPhase === "mode" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">Step {stepNumber} · Mode</h3>
              <div className="ontology-wizard__mode-grid" role="radiogroup" aria-label="Mode">
                <label className="ontology-wizard__mode-card">
                  <input
                    type="radio"
                    name="ontology-mode"
                    value="create"
                    checked={mode === "create"}
                    onChange={() => handleModeChange("create")}
                  />
                  <span className="ontology-wizard__mode-title">Manual</span>
                  <span className="ontology-wizard__mode-copy">
                    Define title, namespace, and prefix. A minimal ontology document is
                    generated for materialization.
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
                  <span className="ontology-wizard__mode-title">OWL Import</span>
                  <span className="ontology-wizard__mode-copy">
                    Import existing OWL/RDF content from a file upload or pasted text.
                  </span>
                </label>
              </div>
            </div>
          )}

          {currentPhase === "edit" && mode === "create" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">
                Step {stepNumber} · Define ontology
              </h3>
              <p className="ontology-wizard__panel-lead">
                Manual mode captures namespace and prefix, then generates Turtle for
                materialization — not application metadata alone.
              </p>
              <div className="ontology-wizard__edit-grid">
                <div className="ontology-wizard__edit-form">
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
                    <p className="agent-runs-page__field-hint">
                      This IRI identifies the ontology document in the semantic layer.
                    </p>
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
                  <div className="agent-runs-page__field">
                    <label htmlFor="ontology-manual-description">
                      Description <span className="agent-runs-page__optional">(optional)</span>
                    </label>
                    <textarea
                      id="ontology-manual-description"
                      rows={3}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </div>
                  <ValidationChecklist checks={manualValidationChecks} />
                </div>
                <div className="ontology-wizard__review-card">
                  <h4>Live Turtle preview</h4>
                  <pre className="ontology-wizard__source-preview">
                    {generatedSourceContent.trim()
                      ? previewSourceContent(generatedSourceContent)
                      : "Complete the fields to preview the generated ontology document."}
                  </pre>
                </div>
              </div>
              {editStepValid && (
                <p className="platform-page__field-hint" role="status">
                  Basic validation passed — ready to choose a connector.
                </p>
              )}
            </div>
          )}

          {currentPhase === "edit" && mode === "import" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">
                Step {stepNumber} · Import OWL/RDF
              </h3>
              <p className="ontology-wizard__panel-lead">
                Upload or paste ontology content. Basic RDF structure is checked before
                connector materialization.
              </p>
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

                <div className="ontology-wizard__source-tabs" role="tablist" aria-label="Import source">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sourceMethod === "file"}
                    className={`ontology-wizard__source-tab${
                      sourceMethod === "file" ? " ontology-wizard__source-tab--active" : ""
                    }`}
                    onClick={() => {
                      setSourceMethod("file");
                      setStepError(null);
                    }}
                  >
                    Upload file
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sourceMethod === "paste"}
                    className={`ontology-wizard__source-tab${
                      sourceMethod === "paste" ? " ontology-wizard__source-tab--active" : ""
                    }`}
                    onClick={() => {
                      setSourceMethod("paste");
                      setStepError(null);
                    }}
                  >
                    Paste text
                  </button>
                </div>

                {sourceMethod === "file" ? (
                  <div className="agent-runs-page__field">
                    <label htmlFor="ontology-import-file">Ontology file</label>
                    <input
                      id="ontology-import-file"
                      type="file"
                      accept=".owl,.xml,.ttl,.rdf,.jsonld,text/plain,application/xml"
                      onChange={(event) => void handleFileChange(event)}
                    />
                    {sourceFileName ? (
                      <p className="ontology-wizard__file-info" role="status">
                        {sourceFileName}
                        {sourceFileSize !== null && ` · ${formatFileSize(sourceFileSize)}`}
                        {` · format: ${effectiveSourceFormat}`}
                      </p>
                    ) : (
                      <p className="agent-runs-page__field-hint">
                        Accepted formats include TTL, RDF/XML, OWL, and JSON-LD.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="agent-runs-page__field">
                    <label htmlFor="ontology-import-content">Ontology content</label>
                    <textarea
                      id="ontology-import-content"
                      rows={14}
                      className="ontology-wizard__import-textarea"
                      value={sourceContent}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSourceContent(value);
                        const inferredFormat = inferSourceFormatFromContent(value);
                        if (inferredFormat) {
                          setSourceFormat(inferredFormat);
                        }
                        setStepError(null);
                      }}
                    />
                  </div>
                )}

                {contentForSubmission && (
                  <div className="ontology-wizard__review-card">
                    <h4>Artifact preview</h4>
                    <pre className="ontology-wizard__source-preview">
                      {previewSourceContent(contentForSubmission)}
                    </pre>
                  </div>
                )}

                <ValidationChecklist checks={importValidationChecks} />
                {editStepValid && (
                  <p className="platform-page__field-hint" role="status">
                    Basic validation passed — ready to choose a connector.
                  </p>
                )}
              </div>
            </div>
          )}

          {currentPhase === "connector" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">Step {stepNumber} · Connector</h3>
              <div className="ontology-wizard__step-body">
                <div className="agent-runs-page__field">
                  <label htmlFor="ontology-import-connector">Target connector</label>
                  <select
                    id="ontology-import-connector"
                    value={connectorId}
                    onChange={(event) => {
                      setConnectorId(event.target.value);
                      setStepError(null);
                    }}
                  >
                    {activeConnectors.map((connector) => (
                      <option key={connector.id} value={connector.id}>
                        {formatConnectorLabel(connector)} (
                        {CONNECTOR_TYPE_LABELS[connector.connector_type]})
                      </option>
                    ))}
                  </select>
                  <p className="agent-runs-page__field-hint">
                    The connector materializes the ontology into the selected vendor without
                    coupling application logic to that technology.
                  </p>
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
                      ? "Manual mode always generates Turtle and submits it through the import pipeline."
                      : "Adjust this if the pasted or uploaded content uses a different RDF serialization."}
                  </p>
                </div>
                {mode === "import" && (
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
                )}
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

          {currentPhase === "review" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">Step {stepNumber} · Review & run</h3>
              <div className="ontology-wizard__review-grid">
                <div className="ontology-wizard__review-card">
                  <h4>Summary</h4>
                  <dl className="ontology-wizard__review-list">
                    <div>
                      <dt>Mode</dt>
                      <dd>{mode ? formatModeLabel(mode) : "—"}</dd>
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
                        <dd>
                          {sourceMethod === "file"
                            ? sourceFileName || "Uploaded file"
                            : "Pasted text"}
                        </dd>
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

              <div className="ontology-wizard__what-happens">
                <h4>What will happen</h4>
                <ol>
                  <li>Validate the submitted ontology artifact</li>
                  <li>Materialize content through the selected connector</li>
                  <li>Register the ontology definition as Draft</li>
                  <li>Record a semantic transaction (<code>ontology.imported</code>)</li>
                </ol>
              </div>

              {validationLoading && (
                <p className="ontologies-page__status" role="status">
                  Running structural validation…
                </p>
              )}

              {backendValidationReport && (
                <div className="ontology-wizard__review-card">
                  <h4>Validation report</h4>
                  <p>
                    {backendValidationReport.passed
                      ? "Structural validation passed"
                      : "Structural validation failed"}
                    {" · "}
                    {backendValidationReport.error_count} errors,{" "}
                    {backendValidationReport.warning_count} warnings
                  </p>
                  <ul className="ontology-wizard__validation-checklist">
                    {backendValidationReport.findings
                      .filter((finding) => finding.level !== "info")
                      .map((finding) => (
                        <li
                          key={`${finding.code}-${finding.message}`}
                          className={`ontology-wizard__validation-item${
                            finding.level === "error"
                              ? ""
                              : " ontology-wizard__validation-item--passed"
                          }`}
                        >
                          <span className="ontology-wizard__validation-marker" aria-hidden="true">
                            {finding.level === "error" ? "✕" : "!"}
                          </span>
                          {finding.message}
                        </li>
                      ))}
                  </ul>
                  {backendValidationReport.ai_summary && (
                    <p className="ontology-wizard__hint">{backendValidationReport.ai_summary}</p>
                  )}
                </div>
              )}
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
            {step < visibleSteps.length - 1 ? (
              <button type="button" onClick={() => void handleNext()} disabled={validationLoading}>
                {validationLoading ? "Validating…" : "Next"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || validationLoading || backendValidationBlocking}
              >
                {submitting ? "Materializing…" : "Materialize ontology"}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
