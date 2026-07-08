import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api";
import {
  createOntology,
  generateOntology,
  importOntology,
  materializeOntology,
  runOntologyValidation,
  updateOntology,
  updateOntologyConnector,
  updateOntologyStatus,
  validateOntologyContent,
  type OntologyDefinitionResponse,
  type OntologyExtraction,
  type OntologyGenerationSource,
  type OntologyGenerationSourceKind,
  type OntologySemanticReview,
  type OntologyValidationReport,
} from "../api/ontologies";
import { ManualOntologyDraftEditor } from "../components/ManualOntologyDraftEditor";
import { GeneratedCandidateReview } from "../components/GeneratedCandidateReview";
import { OntologyValidationInventoryView } from "../components/OntologyValidationInventory";
import { SemanticReviewPanel } from "../components/SemanticReviewPanel";
import { listConnectors, type ConnectorResponse } from "../api/adapters";
import {
  buildManualDraftValidationChecks,
  buildOntologyDefinition,
  buildOntologyDefinitionWithImport,
  buildTurtleFromDefinition,
  buildTurtleFromDraft,
  createRowId,
  localNameFromLabel,
  type OntologyClassRow,
  type OntologyDataPropertyRow,
  type OntologyObjectPropertyRow,
} from "../lib/ontologyDraft";
import {
  extractionToRows,
  rowsToGeneratedDefinition,
  type GeneratedDraftRows,
} from "../lib/ontologyExtraction";
import {
  GENERATE_SOURCE_FILE_ACCEPT,
  readGenerateSourceFile,
} from "../lib/generateSourceFiles";
import { normalizeAndValidateGenerateSourceUrl } from "../lib/generateSourceUrl";

interface OntologyStudioPageProps {
  applicationId: string;
}

type WizardMode = "create" | "import" | "generate";
type ImportSourceMethod = "file" | "paste";
type GenerateSourceMethod = "file" | "paste" | "knowledge_source" | "url";
type WizardPhase =
  | "mode"
  | "edit"
  | "validate"
  | "connector"
  | "review"
  | "finalize"
  | "generate_sources"
  | "generate_review";

interface GenerateSourceEntry {
  id: string;
  kind: OntologyGenerationSourceKind;
  name: string;
  content?: string;
  url?: string;
  referenceId?: string;
}

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      activeConnectors: ConnectorResponse[];
    };

const FULL_WIZARD_STEPS = [
  "Mode",
  "Edit draft",
  "Validate",
  "Connector",
  "Review & run",
  "Approve & materialize",
] as const;

const FOCUSED_WIZARD_STEPS = [
  "Edit draft",
  "Validate",
  "Connector",
  "Review & run",
  "Approve & materialize",
] as const;

const GENERATE_WIZARD_STEPS = [
  "Mode",
  "Add sources",
  "Review candidates",
  "Connector",
  "Review & run",
  "Approve & materialize",
] as const;

const GENERATE_FOCUSED_STEPS = [
  "Add sources",
  "Review candidates",
  "Connector",
  "Review & run",
  "Approve & materialize",
] as const;

const GRAPH_STORE_CONNECTOR_LABEL = "Graph store connector";
const PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

function listActiveOntologyConnectors(connectors: ConnectorResponse[]): ConnectorResponse[] {
  return connectors.filter((connector) => connector.status === "Active");
}

function formatConnectorLabel(connector: ConnectorResponse): string {
  return connector.title;
}

function formatModeLabel(mode: WizardMode): string {
  if (mode === "create") {
    return "Manual";
  }
  if (mode === "generate") {
    return "Generate from Sources";
  }
  return "OWL Import";
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

function formatGenerateSourceLabel(entry: GenerateSourceEntry): string {
  if (entry.kind === "url") {
    return entry.url ?? entry.name;
  }
  if (entry.kind === "file") {
    return entry.name;
  }
  return entry.name;
}

function formatGenerateSourceMeta(entry: GenerateSourceEntry): string {
  if (entry.kind === "url") {
    return `url · ${entry.url ?? entry.name}`;
  }
  if (entry.kind === "file") {
    return `file · ${entry.content?.length ?? 0} chars`;
  }
  return `${entry.kind.replace("_", " ")} · ${entry.content?.length ?? 0} chars`;
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

function stepsForMode(
  mode: WizardMode | null,
  skipModeStep: boolean,
): readonly string[] {
  if (mode === "generate") {
    return skipModeStep ? GENERATE_FOCUSED_STEPS : GENERATE_WIZARD_STEPS;
  }
  return skipModeStep ? FOCUSED_WIZARD_STEPS : FULL_WIZARD_STEPS;
}

function phaseForStep(
  step: number,
  mode: WizardMode | null,
  skipModeStep: boolean,
): WizardPhase {
  const phases: WizardPhase[] =
    mode === "generate"
      ? skipModeStep
        ? ["generate_sources", "generate_review", "connector", "review", "finalize"]
        : ["mode", "generate_sources", "generate_review", "connector", "review", "finalize"]
      : skipModeStep
        ? ["edit", "validate", "connector", "review", "finalize"]
        : ["mode", "edit", "validate", "connector", "review", "finalize"];
  return phases[step] ?? "mode";
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

function ValidationReportPanel({ report }: { report: OntologyValidationReport }) {
  return (
    <div className="ontology-wizard__review-card">
      <h4>Validation report</h4>
      <p>
        {report.passed ? "Structural validation passed" : "Structural validation failed"}
        {" · "}
        {report.error_count} errors, {report.warning_count} warnings
      </p>
      <ul className="ontology-wizard__validation-checklist">
        {report.findings
          .filter((finding) => finding.level !== "info")
          .map((finding) => (
            <li
              key={`${finding.code}-${finding.message}`}
              className={`ontology-wizard__validation-item${
                finding.level === "error" ? "" : " ontology-wizard__validation-item--passed"
              }`}
            >
              <span className="ontology-wizard__validation-marker" aria-hidden="true">
                {finding.level === "error" ? "✕" : "!"}
              </span>
              {finding.message}
            </li>
          ))}
      </ul>
      {report.ai_summary && <p className="ontology-wizard__hint">{report.ai_summary}</p>}
      <OntologyValidationInventoryView inventory={report.inventory} />
    </div>
  );
}

interface ImportParseReviewProps {
  report: OntologyValidationReport;
  approved: boolean;
  onApprovedChange: (approved: boolean) => void;
}

function ImportParseReview({ report, approved, onApprovedChange }: ImportParseReviewProps) {
  const errors = report.findings.filter((finding) => finding.level === "error");
  const warnings = report.findings.filter((finding) => finding.level === "warning");
  const hasBlockingErrors = report.error_count > 0;

  return (
    <div className="ontology-wizard__review-card">
      <h4>Parsed content</h4>
      <p>
        {hasBlockingErrors ? "Parse failed" : "Parse succeeded"}
        {" · "}
        {report.error_count} errors, {report.warning_count} warnings
      </p>

      {errors.length > 0 && (
        <div className="ontology-wizard__parse-errors">
          <h5>Blocking errors</h5>
          <ul className="ontology-wizard__validation-checklist">
            {errors.map((finding) => (
              <li
                key={`error-${finding.code}-${finding.message}`}
                className="ontology-wizard__validation-item"
              >
                <span className="ontology-wizard__validation-marker" aria-hidden="true">
                  ✕
                </span>
                {finding.message}
              </li>
            ))}
          </ul>
          <p className="ontology-wizard__hint">
            Resolve these errors before continuing to the Connector step.
          </p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="ontology-wizard__parse-warnings" role="status">
          <h5>Warnings</h5>
          <ul className="ontology-wizard__validation-checklist">
            {warnings.map((finding) => (
              <li
                key={`warning-${finding.code}-${finding.message}`}
                className="ontology-wizard__validation-item ontology-wizard__validation-item--passed"
              >
                <span className="ontology-wizard__validation-marker" aria-hidden="true">
                  !
                </span>
                {finding.message}
              </li>
            ))}
          </ul>
          <p className="ontology-wizard__hint">
            Warnings are advisory — you can proceed past them without changes.
          </p>
        </div>
      )}

      {report.ai_summary && <p className="ontology-wizard__hint">{report.ai_summary}</p>}

      <OntologyValidationInventoryView inventory={report.inventory} />

      {!hasBlockingErrors && (
        <label className="ontology-wizard__approval">
          <input
            type="checkbox"
            checked={approved}
            onChange={(event) => onApprovedChange(event.target.checked)}
          />
          <span>I approve this parsed content to become the ontology draft</span>
        </label>
      )}
    </div>
  );
}

export function OntologyStudioPage({ applicationId }: OntologyStudioPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialMode = useMemo((): WizardMode | null => {
    const modeParam = searchParams.get("mode")?.toLowerCase();
    if (modeParam === "manual" || modeParam === "create") {
      return "create";
    }
    if (modeParam === "import") {
      return "import";
    }
    if (modeParam === "generate") {
      return "generate";
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
  const [draftOntologyId, setDraftOntologyId] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [backendValidationReport, setBackendValidationReport] =
    useState<OntologyValidationReport | null>(null);
  const [semanticReview, setSemanticReview] = useState<OntologySemanticReview | null>(null);
  const [parsedContentApproved, setParsedContentApproved] = useState(false);
  const [manualClasses, setManualClasses] = useState<OntologyClassRow[]>([
    { id: createRowId(), label: "", description: "" },
  ]);
  const [manualObjectProperties, setManualObjectProperties] = useState<
    OntologyObjectPropertyRow[]
  >([]);
  const [manualDataProperties, setManualDataProperties] = useState<OntologyDataPropertyRow[]>(
    [],
  );
  const [draftSaving, setDraftSaving] = useState(false);
  const [generateSourceMethod, setGenerateSourceMethod] = useState<GenerateSourceMethod>("file");
  const [generateSources, setGenerateSources] = useState<GenerateSourceEntry[]>([]);
  const [pasteName, setPasteName] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [knowledgeReference, setKnowledgeReference] = useState("");
  const [knowledgeName, setKnowledgeName] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlName, setUrlName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedExtraction, setGeneratedExtraction] = useState<OntologyExtraction | null>(null);
  const [generatedRows, setGeneratedRows] = useState<GeneratedDraftRows | null>(null);
  const [generatedDefinition, setGeneratedDefinition] = useState<Record<string, unknown>>({});
  const [generateApproved, setGenerateApproved] = useState(false);

  const visibleSteps = stepsForMode(mode, skipModeStep);
  const currentPhase = phaseForStep(step, mode, skipModeStep);
  const pageTitle = mode
    ? `Create ontology · ${formatModeLabel(mode)}`
    : "Create ontology";

  useEffect(() => {
    if (currentPhase !== "finalize" || !draftOntologyId) {
      return;
    }

    let cancelled = false;
    setValidationLoading(true);
    setStepError(null);

    runOntologyValidation(draftOntologyId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setBackendValidationReport(result.report);
        setSemanticReview(result.semantic_review);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to run ontology validation";
          setStepError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setValidationLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentPhase, draftOntologyId]);

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
  const manualDraftInput = useMemo(
    () => ({
      title: title.trim(),
      namespaceIri: namespaceIri.trim(),
      prefix: normalizedPrefix,
      description: description.trim(),
      classes: manualClasses,
      objectProperties: manualObjectProperties,
      dataProperties: manualDataProperties,
    }),
    [
      description,
      manualClasses,
      manualDataProperties,
      manualObjectProperties,
      namespaceIri,
      normalizedPrefix,
      title,
    ],
  );
  const manualClassNameOptions = useMemo(
    () =>
      manualClasses
        .map((row, index) => localNameFromLabel(row.label, `Class${index + 1}`))
        .filter(Boolean),
    [manualClasses],
  );
  const generatedSourceContent = useMemo(() => {
    if (mode !== "create") {
      return "";
    }

    return buildTurtleFromDraft(manualDraftInput);
  }, [manualDraftInput, mode]);

  const contentForSubmission = mode === "create" ? generatedSourceContent : sourceContent.trim();
  const effectiveSourceFormat = mode === "create" ? "ttl" : sourceFormat.trim() || "ttl";

  const manualValidationChecks = useMemo((): ValidationCheck[] => {
    if (mode !== "create") {
      return [];
    }

    return buildManualDraftValidationChecks(manualDraftInput);
  }, [manualDraftInput, mode]);

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
          sourceMethod === "file" ? "Ontology file uploaded" : "Ontology content pasted",
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

  async function runBackendValidation(): Promise<OntologyValidationReport | null> {
    if (!contentForSubmission && !draftOntologyId) {
      return null;
    }

    setValidationLoading(true);
    try {
      if (draftOntologyId) {
        const result = await runOntologyValidation(draftOntologyId);
        setBackendValidationReport(result.report);
        setSemanticReview(result.semantic_review);
        return result.report;
      }

      const report = await validateOntologyContent({
        source_format: effectiveSourceFormat,
        source_content: contentForSubmission,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        application_id: applicationId,
      });
      setBackendValidationReport(report);
      setSemanticReview(null);
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

    if (phase === "validate") {
      if (backendValidationReport && backendValidationReport.error_count > 0) {
        return "Resolve validation errors before continuing";
      }

      if (mode === "import" && !parsedContentApproved) {
        return "Approve the parsed content to continue";
      }
    }

    if (phase === "connector") {
      if (!connectorId) {
        return `${GRAPH_STORE_CONNECTOR_LABEL} is required`;
      }

      if (mode === "import") {
        if (!sourceFormat.trim()) {
          return "Source format is required";
        }

        if (!parsedContentApproved) {
          return "Approve the parsed content before creating the draft";
        }
      }
    }

    if (phase === "review") {
      if (!connectorId || !contentForSubmission) {
        return "Complete the flow before creating the draft";
      }

      if (mode === "import" && !parsedContentApproved) {
        return "Approve the parsed content before creating the draft";
      }
    }

    if (phase === "finalize") {
      if (!draftOntologyId) {
        return "Create the ontology draft before approving and materializing";
      }
    }

    return null;
  }

  function handleModeChange(nextMode: WizardMode) {
    setMode(nextMode);
    setStepError(null);
    setSubmitError(null);
    setBackendValidationReport(null);
    setSemanticReview(null);
    setParsedContentApproved(false);
    setDraftOntologyId(null);
    setGeneratedExtraction(null);
    setGeneratedRows(null);
    setGenerateApproved(false);

    if (nextMode === "create") {
      setSourceFormat("ttl");
    }
  }

  function toGenerationSourcePayload(entry: GenerateSourceEntry): OntologyGenerationSource {
    if (entry.kind === "url") {
      return {
        kind: "url",
        url: entry.url,
        ...(entry.name.trim() ? { name: entry.name.trim() } : {}),
      };
    }

    return {
      kind: entry.kind,
      content: entry.content ?? "",
      ...(entry.name.trim() ? { name: entry.name.trim() } : {}),
      ...(entry.referenceId && entry.referenceId.trim()
        ? { reference_id: entry.referenceId.trim() }
        : {}),
    };
  }

  async function handleGenerateSourceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await readGenerateSourceFile(file);
      setGenerateSources((current) => [
        ...current,
        { id: createRowId(), kind: "file", name: file.name, content: text },
      ]);
      setStepError(null);
      setSubmitError(null);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, ""));
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to read the selected file";
      setSubmitError(message);
    } finally {
      event.target.value = "";
    }
  }

  function handleAddUrlSource() {
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeAndValidateGenerateSourceUrl(urlInput);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Enter a valid URL (for example https://example.com/page)";
      setStepError(message);
      return;
    }

    setGenerateSources((current) => [
      ...current,
      {
        id: createRowId(),
        kind: "url",
        name: urlName.trim() || normalizedUrl,
        content: "",
        url: normalizedUrl,
      },
    ]);
    setUrlInput("");
    setUrlName("");
    setStepError(null);
    setSubmitError(null);
  }

  function handleAddPasteSource() {
    if (!pasteContent.trim()) {
      setStepError("Paste some text before adding it as a source");
      return;
    }

    setGenerateSources((current) => [
      ...current,
      {
        id: createRowId(),
        kind: "paste",
        name: pasteName.trim() || "Pasted text",
        content: pasteContent,
      },
    ]);
    setPasteName("");
    setPasteContent("");
    setStepError(null);
  }

  function handleAddKnowledgeSource() {
    if (!knowledgeContent.trim()) {
      setStepError("Provide the knowledge source text before adding it");
      return;
    }
    if (!knowledgeReference.trim() && !knowledgeName.trim()) {
      setStepError("Provide a knowledge source reference id or name");
      return;
    }

    setGenerateSources((current) => [
      ...current,
      {
        id: createRowId(),
        kind: "knowledge_source",
        name: knowledgeName.trim() || knowledgeReference.trim(),
        content: knowledgeContent,
        referenceId: knowledgeReference.trim() || undefined,
      },
    ]);
    setKnowledgeReference("");
    setKnowledgeName("");
    setKnowledgeContent("");
    setStepError(null);
  }

  function handleRemoveGenerateSource(id: string) {
    setGenerateSources((current) => current.filter((entry) => entry.id !== id));
    setStepError(null);
  }

  async function handleGenerateDraft(): Promise<boolean> {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setStepError("Title is required");
      return false;
    }
    if (generateSources.length === 0) {
      setStepError("Add at least one source to generate from");
      return false;
    }

    setStepError(null);
    setSubmitError(null);
    setGenerating(true);

    try {
      const createdByValue = createdBy.trim();
      const descriptionValue = description.trim();
      const response = await generateOntology({
        application_id: applicationId,
        title: trimmedTitle,
        sources: generateSources.map(toGenerationSourcePayload),
        ...(createdByValue ? { created_by: createdByValue } : {}),
        ...(descriptionValue ? { description: descriptionValue } : {}),
      });

      setDraftOntologyId(response.ontology.id);
      setGeneratedExtraction(response.extraction);
      setGeneratedRows(extractionToRows(response.extraction));
      setGeneratedDefinition(response.ontology.ontology_definition);
      setGenerateApproved(false);
      setStep((current) => Math.min(current + 1, visibleSteps.length - 1));
      return true;
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to generate ontology draft from sources";
      setSubmitError(message);
      return false;
    } finally {
      setGenerating(false);
    }
  }

  async function handleApproveGeneratedDraft() {
    if (!generateApproved) {
      setStepError("Approve the generated draft to continue");
      return;
    }
    if (!draftOntologyId || !generatedRows) {
      setStepError("Generate a draft before approving");
      return;
    }

    setStepError(null);
    setSubmitError(null);
    setSubmitting(true);

    try {
      const descriptionValue = description.trim();
      const definition = rowsToGeneratedDefinition(generatedRows, generatedDefinition);
      await updateOntology(draftOntologyId, {
        title: title.trim(),
        ...(descriptionValue ? { description: descriptionValue } : { description: null }),
        ontology_definition: definition,
      });

      setStep((current) => Math.min(current + 1, visibleSteps.length - 1));
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to save the generated ontology draft";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveManualDraft(options?: {
    connectorId?: string;
    includeImportMetadata?: boolean;
    manageLoading?: boolean;
  }): Promise<boolean> {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setStepError("Title is required");
      return false;
    }

    const descriptionValue = description.trim();
    const createdByValue = createdBy.trim();
    const ontologyDefinition = (
      options?.includeImportMetadata
        ? buildOntologyDefinitionWithImport(manualDraftInput, {
            sourceContent: generatedSourceContent,
            ontologyId: draftOntologyId,
            validationReport: backendValidationReport
              ? (backendValidationReport as unknown as Record<string, unknown>)
              : undefined,
          })
        : buildOntologyDefinition(manualDraftInput)
    ) as unknown as Record<string, unknown>;

    if (options?.manageLoading !== false) {
      setDraftSaving(true);
    }
    setStepError(null);

    try {
      if (draftOntologyId) {
        await updateOntology(draftOntologyId, {
          title: trimmedTitle,
          ...(descriptionValue ? { description: descriptionValue } : { description: null }),
          ontology_definition: ontologyDefinition,
        });
      } else {
        const created = await createOntology({
          application_id: applicationId,
          title: trimmedTitle,
          ...(descriptionValue ? { description: descriptionValue } : {}),
          ...(createdByValue ? { created_by: createdByValue } : {}),
          ...(options?.connectorId ? { connector_id: options.connectorId } : {}),
          ontology_definition: ontologyDefinition,
        });
        setDraftOntologyId(created.id);
      }
      return true;
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to save ontology draft";
      setStepError(message);
      return false;
    } finally {
      if (options?.manageLoading !== false) {
        setDraftSaving(false);
      }
    }
  }

  async function handleNext() {
    if (currentPhase === "generate_sources") {
      await handleGenerateDraft();
      return;
    }

    if (currentPhase === "edit" && mode === "create") {
      const editMessage = validatePhase("edit");
      if (editMessage) {
        setStepError(editMessage);
        return;
      }

      if (draftOntologyId) {
        const saved = await saveManualDraft();
        if (!saved) {
          return;
        }
      }

      setStepError(null);
      setStep((current) => Math.min(current + 1, visibleSteps.length - 1));
      return;
    }

    if (currentPhase === "connector" && mode === "create") {
      const connectorMessage = validatePhase("connector");
      if (connectorMessage) {
        setStepError(connectorMessage);
        return;
      }

      const saved = await saveManualDraft({ connectorId });
      if (!saved) {
        return;
      }

      setStepError(null);
      setStep((current) => Math.min(current + 1, visibleSteps.length - 1));
      return;
    }

    if (currentPhase === "connector" && mode === "generate") {
      const connectorMessage = validatePhase("connector");
      if (connectorMessage) {
        setStepError(connectorMessage);
        return;
      }
      if (!draftOntologyId) {
        setStepError("Generate a draft before selecting a connector");
        return;
      }

      setDraftSaving(true);
      setStepError(null);
      try {
        await updateOntologyConnector(draftOntologyId, connectorId);
      } catch (error: unknown) {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to attach the selected connector";
        setStepError(message);
        return;
      } finally {
        setDraftSaving(false);
      }

      setStep((current) => Math.min(current + 1, visibleSteps.length - 1));
      return;
    }

    if (currentPhase === "validate") {
      setStepError(null);
      const report =
        backendValidationReport && backendValidationReport.error_count === 0
          ? backendValidationReport
          : await runBackendValidation();
      if (!report) {
        return;
      }
      if (report.error_count > 0) {
        setStepError("Resolve validation errors before continuing");
        return;
      }
      if (mode === "import" && !parsedContentApproved) {
        setStepError("Approve the parsed content to continue");
        return;
      }
      setStep((current) => Math.min(current + 1, visibleSteps.length - 1));
      return;
    }

    const message = validatePhase(currentPhase);
    if (message) {
      setStepError(message);
      return;
    }

    setStepError(null);
    setStep((current) => Math.min(current + 1, visibleSteps.length - 1));
  }

  function handleBack() {
    setStepError(null);
    setSubmitError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleCreateDraft(): Promise<boolean> {
    const reviewValidation = validatePhase("review");
    if (reviewValidation) {
      setStepError(reviewValidation);
      return false;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !connectorId || !contentForSubmission) {
      setStepError("Complete the flow before creating the draft");
      return false;
    }

    setStepError(null);
    setSubmitError(null);
    setSubmitting(true);

    try {
      if (mode === "create") {
        const saved = await saveManualDraft({
          connectorId,
          includeImportMetadata: true,
          manageLoading: false,
        });
        if (!saved) {
          return false;
        }

        setStep((current) => Math.min(current + 1, visibleSteps.length - 1));
        return true;
      }

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

      setDraftOntologyId(ontology.id);
      if (ontology.artifact_uri) {
        setSubmitError(
          "Draft creation returned an artifact URI unexpectedly. Continue only after confirming draft-only import.",
        );
        return false;
      }

      setStep((current) => Math.min(current + 1, visibleSteps.length - 1));
      return true;
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create ontology draft";
      setSubmitError(message);
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  function redirectAfterMaterialize(ontology: OntologyDefinitionResponse) {
    const transactionId = ontology.semantic_transaction_id;
    if (transactionId) {
      navigate(`/applications/${applicationId}/semantic-transactions/${transactionId}`);
      return;
    }
    navigate(`/applications/${applicationId}/ontology`);
  }

  async function handleApproveAndMaterialize() {
    const finalizeValidation = validatePhase("finalize");
    if (finalizeValidation) {
      setSubmitError(finalizeValidation);
      return;
    }

    if (!draftOntologyId) {
      return;
    }

    setStepError(null);
    setSubmitError(null);
    setSubmitting(true);

    try {
      let report = backendValidationReport;
      if (!report?.passed) {
        const validationResult = await runOntologyValidation(draftOntologyId);
        report = validationResult.report;
        setBackendValidationReport(report);
        setSemanticReview(validationResult.semantic_review);
      }

      if (!report.passed) {
        setSubmitError("Resolve validation errors before approving and materializing");
        return;
      }

      await updateOntologyStatus(draftOntologyId, "Validated");
      await updateOntologyStatus(draftOntologyId, "Approved");
      const materialized = await materializeOntology(draftOntologyId);

      redirectAfterMaterialize(materialized);
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to approve and materialize ontology";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (currentPhase === "generate_review") {
      await handleApproveGeneratedDraft();
      return;
    }

    if (currentPhase === "review") {
      if (mode === "generate") {
        setStepError(null);
        setSubmitError(null);
        setStep((current) => Math.min(current + 1, visibleSteps.length - 1));
        return;
      }
      await handleCreateDraft();
      return;
    }

    if (currentPhase === "finalize") {
      await handleApproveAndMaterialize();
    }
  }

  function handleImportMethodChange(method: ImportSourceMethod) {
    if (method === sourceMethod) {
      return;
    }

    setSourceMethod(method);
    setBackendValidationReport(null);
    setParsedContentApproved(false);
    setStepError(null);
    setSubmitError(null);
  }

  function handlePasteContentChange(value: string) {
    setSourceContent(value);
    setBackendValidationReport(null);
    setParsedContentApproved(false);
    setStepError(null);
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
      setBackendValidationReport(null);
      setParsedContentApproved(false);
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

  const { activeConnectors } = state;
  const selectedConnector =
    activeConnectors.find((connector) => connector.id === connectorId) ??
    activeConnectors[0] ??
    null;
  const sourcePreview = previewSourceContent(contentForSubmission);
  const generatedTurtlePreview =
    mode === "generate" && generatedRows
      ? buildTurtleFromDefinition(
          {
            classes: generatedRows.classes,
            properties: generatedRows.properties,
            relationships: generatedRows.relationships,
          },
          { title: title.trim(), description: description.trim() },
        )
      : "";
  const reviewSourcePreview =
    mode === "generate" ? previewSourceContent(generatedTurtlePreview) : sourcePreview;
  const reviewCounts = ((): {
    classCount: number;
    objectPropertyCount: number;
    dataPropertyCount: number;
  } => {
    if (mode === "create") {
      const definition = buildOntologyDefinition(manualDraftInput);
      return {
        classCount: definition.classes.length,
        objectPropertyCount: definition.relationships.length,
        dataPropertyCount: definition.properties.length,
      };
    }
    if (mode === "generate" && generatedRows) {
      return {
        classCount: generatedRows.classes.filter((row) => row.name.trim()).length,
        objectPropertyCount: generatedRows.relationships.filter((row) => row.name.trim()).length,
        dataPropertyCount: generatedRows.properties.filter((row) => row.name.trim()).length,
      };
    }
    const inventory = backendValidationReport?.inventory;
    if (inventory) {
      return {
        classCount: inventory.classes.length,
        objectPropertyCount: inventory.relations.filter(
          (relation) => relation.property_type === "object",
        ).length,
        dataPropertyCount: inventory.relations.filter(
          (relation) => relation.property_type === "datatype",
        ).length,
      };
    }
    return { classCount: 0, objectPropertyCount: 0, dataPropertyCount: 0 };
  })();
  const hasBlockingValidationErrors = backendValidationReport
    ? backendValidationReport.error_count > 0
    : false;
  const validationStatusLabel = backendValidationReport
    ? backendValidationReport.passed
      ? `Passed · ${backendValidationReport.warning_count} warning(s)`
      : `Failed · ${backendValidationReport.error_count} error(s)`
    : mode === "generate"
      ? "Runs on Approve & materialize"
      : "Not yet run";
  const stepNumber = step + 1;
  const hasActiveConnectors = activeConnectors.length > 0;
  const connectorGateBlocksWizard = !hasActiveConnectors && mode !== "generate";
  const isLastStep = step >= visibleSteps.length - 1;
  const isReviewStep = currentPhase === "review";
  const isGenerateSources = currentPhase === "generate_sources";
  const isGenerateReview = currentPhase === "generate_review";

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
              ? "Define business meaning from scratch. A draft is validated, approved, then materialized through your graph store connector."
              : mode === "import"
                ? "Import existing OWL/RDF semantics. Content is validated, saved as a draft, approved, then materialized."
                : mode === "generate"
                  ? "Extract candidate concepts from your sources. Review and edit the suggestions, then approve the editable draft."
                  : "Capture business meaning for this application. Choose a creation mode to continue."}
          </p>
        </div>
      </div>

      {connectorGateBlocksWizard ? (
        <div className="agent-runs-page__empty" role="status">
          <p>
            No graph store connector is ready yet. Create one under Platform → Connectors, test
            the connection, and save it — then return here to create an ontology.
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
                    Define title, namespace, and prefix. A minimal ontology document is generated
                    as a draft for validation and materialization.
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
                <label className="ontology-wizard__mode-card">
                  <input
                    type="radio"
                    name="ontology-mode"
                    value="generate"
                    checked={mode === "generate"}
                    onChange={() => handleModeChange("generate")}
                  />
                  <span className="ontology-wizard__mode-title">Generate from Sources</span>
                  <span className="ontology-wizard__mode-copy">
                    Extract candidate classes, properties, and relationships from files, pasted
                    text, or an existing knowledge source, then review and edit before approving.
                  </span>
                </label>
              </div>
            </div>
          )}

          {currentPhase === "edit" && mode === "create" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">
                Step {stepNumber} · Edit draft
              </h3>
              <p className="ontology-wizard__panel-lead">
                Manual mode captures namespace and prefix, then generates Turtle for validation
                and materialization — not application metadata alone.
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
                        setBackendValidationReport(null);
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
                        setBackendValidationReport(null);
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
                        setBackendValidationReport(null);
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
                      onChange={(event) => {
                        setDescription(event.target.value);
                        setBackendValidationReport(null);
                      }}
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
              <ManualOntologyDraftEditor
                classes={manualClasses}
                objectProperties={manualObjectProperties}
                dataProperties={manualDataProperties}
                classNameOptions={manualClassNameOptions}
                onClassesChange={(rows) => {
                  setManualClasses(rows);
                  setStepError(null);
                  setBackendValidationReport(null);
                }}
                onObjectPropertiesChange={(rows) => {
                  setManualObjectProperties(rows);
                  setStepError(null);
                  setBackendValidationReport(null);
                }}
                onDataPropertiesChange={(rows) => {
                  setManualDataProperties(rows);
                  setStepError(null);
                  setBackendValidationReport(null);
                }}
              />
              {editStepValid && (
                <p className="platform-page__field-hint" role="status">
                  Basic validation passed — ready to run structural validation.
                </p>
              )}
            </div>
          )}

          {currentPhase === "edit" && mode === "import" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">
                Step {stepNumber} · Edit draft
              </h3>
              <p className="ontology-wizard__panel-lead">
                Provide OWL/RDF/TTL content by uploading a file or pasting text. Basic RDF
                structure is checked before validation.
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
                      setBackendValidationReport(null);
                      setParsedContentApproved(false);
                    }}
                  />
                </div>

                <div
                  className="ontology-wizard__source-tabs"
                  role="tablist"
                  aria-label="Import source method"
                >
                  <button
                    type="button"
                    role="tab"
                    id="import-tab-file"
                    aria-selected={sourceMethod === "file"}
                    aria-controls="import-panel-file"
                    className={`ontology-wizard__source-tab${
                      sourceMethod === "file" ? " ontology-wizard__source-tab--active" : ""
                    }`}
                    onClick={() => handleImportMethodChange("file")}
                  >
                    Upload file
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="import-tab-paste"
                    aria-selected={sourceMethod === "paste"}
                    aria-controls="import-panel-paste"
                    className={`ontology-wizard__source-tab${
                      sourceMethod === "paste" ? " ontology-wizard__source-tab--active" : ""
                    }`}
                    onClick={() => handleImportMethodChange("paste")}
                  >
                    Paste text
                  </button>
                </div>

                {sourceMethod === "file" ? (
                  <div
                    className="agent-runs-page__field"
                    id="import-panel-file"
                    role="tabpanel"
                    aria-labelledby="import-tab-file"
                  >
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
                  <div
                    className="ontology-wizard__step-body"
                    id="import-panel-paste"
                    role="tabpanel"
                    aria-labelledby="import-tab-paste"
                  >
                    <div className="agent-runs-page__field">
                      <label htmlFor="ontology-paste-format">Source format</label>
                      <select
                        id="ontology-paste-format"
                        value={sourceFormat}
                        onChange={(event) => {
                          setSourceFormat(event.target.value);
                          setStepError(null);
                          setBackendValidationReport(null);
                          setParsedContentApproved(false);
                        }}
                      >
                        <option value="ttl">Turtle (TTL)</option>
                        <option value="rdf">RDF/XML</option>
                        <option value="owl">OWL</option>
                        <option value="xml">XML</option>
                        <option value="jsonld">JSON-LD</option>
                      </select>
                    </div>
                    <div className="agent-runs-page__field">
                      <label htmlFor="ontology-paste-content">Ontology content</label>
                      <textarea
                        id="ontology-paste-content"
                        className="ontology-wizard__import-textarea"
                        rows={10}
                        placeholder="@prefix ex: <https://example.com/> ."
                        value={sourceContent}
                        onChange={(event) => handlePasteContentChange(event.target.value)}
                      />
                      <p className="agent-runs-page__field-hint">
                        Paste OWL/RDF/TTL content. It is parsed via the validate step before
                        becoming a draft.
                      </p>
                    </div>
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
                    Basic validation passed — ready to run structural validation.
                  </p>
                )}
              </div>
            </div>
          )}

          {currentPhase === "generate_sources" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">Step {stepNumber} · Add sources</h3>
              <p className="ontology-wizard__panel-lead">
                Provide the sources to extract candidate concepts from. Upload text, CSV, or Excel
                files (parsed in your browser), paste text, add a knowledge source reference, or
                supply a web URL for the server to fetch.
              </p>

              <div className="ontology-wizard__step-body">
                <div className="agent-runs-page__field">
                  <label htmlFor="ontology-generate-title">Title</label>
                  <input
                    id="ontology-generate-title"
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setStepError(null);
                    }}
                  />
                </div>
                <div className="agent-runs-page__field">
                  <label htmlFor="ontology-generate-description">
                    Description <span className="agent-runs-page__optional">(optional)</span>
                  </label>
                  <textarea
                    id="ontology-generate-description"
                    rows={2}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
                <div className="agent-runs-page__field">
                  <label htmlFor="ontology-generate-created-by">
                    Created by <span className="agent-runs-page__optional">(optional)</span>
                  </label>
                  <input
                    id="ontology-generate-created-by"
                    value={createdBy}
                    onChange={(event) => setCreatedBy(event.target.value)}
                  />
                </div>

                <div
                  className="ontology-wizard__source-tabs"
                  role="tablist"
                  aria-label="Generate source method"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={generateSourceMethod === "file"}
                    className={`ontology-wizard__source-tab${
                      generateSourceMethod === "file" ? " ontology-wizard__source-tab--active" : ""
                    }`}
                    onClick={() => setGenerateSourceMethod("file")}
                  >
                    Upload file
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={generateSourceMethod === "paste"}
                    className={`ontology-wizard__source-tab${
                      generateSourceMethod === "paste" ? " ontology-wizard__source-tab--active" : ""
                    }`}
                    onClick={() => setGenerateSourceMethod("paste")}
                  >
                    Paste text
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={generateSourceMethod === "url"}
                    className={`ontology-wizard__source-tab${
                      generateSourceMethod === "url" ? " ontology-wizard__source-tab--active" : ""
                    }`}
                    onClick={() => setGenerateSourceMethod("url")}
                  >
                    Web URL
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={generateSourceMethod === "knowledge_source"}
                    className={`ontology-wizard__source-tab${
                      generateSourceMethod === "knowledge_source"
                        ? " ontology-wizard__source-tab--active"
                        : ""
                    }`}
                    onClick={() => setGenerateSourceMethod("knowledge_source")}
                  >
                    Knowledge source
                  </button>
                </div>

                {generateSourceMethod === "file" && (
                  <div className="agent-runs-page__field">
                    <label htmlFor="ontology-generate-file">Source file</label>
                    <input
                      id="ontology-generate-file"
                      type="file"
                      accept={GENERATE_SOURCE_FILE_ACCEPT}
                      onChange={(event) => void handleGenerateSourceFile(event)}
                    />
                    <p className="agent-runs-page__field-hint">
                      Text, CSV, and Excel (.xlsx) files are read client-side and sent as plain text.
                      Legacy .xls files are not supported — save as .xlsx or .csv.
                    </p>
                  </div>
                )}

                {generateSourceMethod === "paste" && (
                  <div className="ontology-wizard__step-body">
                    <div className="agent-runs-page__field">
                      <label htmlFor="ontology-generate-paste-name">
                        Source name <span className="agent-runs-page__optional">(optional)</span>
                      </label>
                      <input
                        id="ontology-generate-paste-name"
                        value={pasteName}
                        onChange={(event) => setPasteName(event.target.value)}
                      />
                    </div>
                    <div className="agent-runs-page__field">
                      <label htmlFor="ontology-generate-paste-content">Pasted text</label>
                      <textarea
                        id="ontology-generate-paste-content"
                        className="ontology-wizard__import-textarea"
                        rows={6}
                        value={pasteContent}
                        onChange={(event) => setPasteContent(event.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="platform-page__button"
                      onClick={handleAddPasteSource}
                    >
                      Add pasted source
                    </button>
                  </div>
                )}

                {generateSourceMethod === "url" && (
                  <div className="ontology-wizard__step-body">
                    <div className="agent-runs-page__field">
                      <label htmlFor="ontology-generate-url">Web URL</label>
                      <input
                        id="ontology-generate-url"
                        type="url"
                        inputMode="url"
                        placeholder="https://example.com/spec"
                        value={urlInput}
                        onChange={(event) => {
                          setUrlInput(event.target.value);
                          setStepError(null);
                        }}
                      />
                      <p className="agent-runs-page__field-hint">
                        The server fetches http and https pages when you generate the draft.
                      </p>
                    </div>
                    <div className="agent-runs-page__field">
                      <label htmlFor="ontology-generate-url-name">
                        Source name <span className="agent-runs-page__optional">(optional)</span>
                      </label>
                      <input
                        id="ontology-generate-url-name"
                        value={urlName}
                        onChange={(event) => setUrlName(event.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="platform-page__button"
                      onClick={handleAddUrlSource}
                    >
                      Add URL source
                    </button>
                  </div>
                )}

                {generateSourceMethod === "knowledge_source" && (
                  <div className="ontology-wizard__step-body">
                    <div className="agent-runs-page__field">
                      <label htmlFor="ontology-generate-knowledge-ref">
                        Knowledge source reference id
                      </label>
                      <input
                        id="ontology-generate-knowledge-ref"
                        value={knowledgeReference}
                        onChange={(event) => setKnowledgeReference(event.target.value)}
                      />
                    </div>
                    <div className="agent-runs-page__field">
                      <label htmlFor="ontology-generate-knowledge-name">
                        Knowledge source name{" "}
                        <span className="agent-runs-page__optional">(optional)</span>
                      </label>
                      <input
                        id="ontology-generate-knowledge-name"
                        value={knowledgeName}
                        onChange={(event) => setKnowledgeName(event.target.value)}
                      />
                    </div>
                    <div className="agent-runs-page__field">
                      <label htmlFor="ontology-generate-knowledge-content">
                        Knowledge source text
                      </label>
                      <textarea
                        id="ontology-generate-knowledge-content"
                        className="ontology-wizard__import-textarea"
                        rows={6}
                        value={knowledgeContent}
                        onChange={(event) => setKnowledgeContent(event.target.value)}
                      />
                      <p className="agent-runs-page__field-hint">
                        Paste the text of an existing application knowledge source. Its reference id
                        is recorded for lineage.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="platform-page__button"
                      onClick={handleAddKnowledgeSource}
                    >
                      Add knowledge source
                    </button>
                  </div>
                )}

                <div className="ontology-wizard__review-card">
                  <h4>Sources ({generateSources.length})</h4>
                  {generateSources.length === 0 ? (
                    <p className="ontology-wizard__manual-empty">
                      No sources added yet. Add at least one source to generate candidates.
                    </p>
                  ) : (
                    <ul className="ontology-wizard__source-entries" aria-label="Added sources">
                      {generateSources.map((entry) => (
                        <li key={entry.id} className="ontology-wizard__source-entry">
                          <span>
                            <strong>{formatGenerateSourceLabel(entry)}</strong>{" "}
                            <span className="agent-runs-page__optional">
                              ({formatGenerateSourceMeta(entry)})
                            </span>
                          </span>
                          <button
                            type="button"
                            className="platform-page__button platform-table__action"
                            onClick={() => handleRemoveGenerateSource(entry.id)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentPhase === "generate_review" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">
                Step {stepNumber} · Review candidates
              </h3>
              <p className="ontology-wizard__panel-lead">
                These candidate concepts were extracted from your sources. They are advisory — edit,
                remove, or add concepts, then approve the draft. Approval is required before the
                draft can move on to validation and materialization.
              </p>

              {generatedRows && (
                <GeneratedCandidateReview
                  rows={generatedRows}
                  onRowsChange={(rows) => {
                    setGeneratedRows(rows);
                    setStepError(null);
                  }}
                  approved={generateApproved}
                  onApprovedChange={(approved) => {
                    setGenerateApproved(approved);
                    setStepError(null);
                  }}
                  extractionAvailable={generatedExtraction?.available ?? false}
                  summary={generatedExtraction?.summary}
                  model={generatedExtraction?.model}
                />
              )}
            </div>
          )}

          {currentPhase === "validate" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">Step {stepNumber} · Validate</h3>
              <p className="ontology-wizard__panel-lead">
                Run deterministic structural validation on the draft content before selecting a
                graph store connector.
              </p>

              {validationLoading && (
                <p className="ontologies-page__status" role="status">
                  Running structural validation…
                </p>
              )}

              {backendValidationReport ? (
                <>
                  {mode === "import" ? (
                    <ImportParseReview
                      report={backendValidationReport}
                      approved={parsedContentApproved}
                      onApprovedChange={(approved) => {
                        setParsedContentApproved(approved);
                        setStepError(null);
                      }}
                    />
                  ) : (
                    <ValidationReportPanel report={backendValidationReport} />
                  )}
                  {draftOntologyId && semanticReview && (
                    <SemanticReviewPanel
                      ontologyId={draftOntologyId}
                      review={semanticReview}
                      onReviewChange={setSemanticReview}
                      onError={setStepError}
                    />
                  )}
                </>
              ) : (
                <p className="agent-runs-page__field-hint">
                  Click Next to run validation against the submitted ontology content.
                </p>
              )}
            </div>
          )}

          {currentPhase === "connector" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">Step {stepNumber} · Connector</h3>
              <div className="ontology-wizard__step-body">
                {!hasActiveConnectors && (
                  <div className="agent-runs-page__empty" role="status">
                    <p>
                      No graph store connector is ready yet. Create one under Platform →
                      Connectors, test the connection, and save it — then return here to
                      materialize.
                    </p>
                    <p className="agent-runs-page__hint">
                      <Link to="/connectors">Open connectors</Link>
                    </p>
                  </div>
                )}
                <div className="agent-runs-page__field">
                  <label htmlFor="ontology-import-connector">{GRAPH_STORE_CONNECTOR_LABEL}</label>
                  <select
                    id="ontology-import-connector"
                    value={connectorId}
                    disabled={!hasActiveConnectors}
                    onChange={(event) => {
                      setConnectorId(event.target.value);
                      setStepError(null);
                    }}
                  >
                    {activeConnectors.map((connector) => (
                      <option key={connector.id} value={connector.id}>
                        {formatConnectorLabel(connector)}
                      </option>
                    ))}
                  </select>
                  <p className="agent-runs-page__field-hint">
                    The connector materializes the ontology into the selected graph store without
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
                      ? "Manual mode always generates Turtle for the draft import pipeline."
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
                      <dt>{GRAPH_STORE_CONNECTOR_LABEL}</dt>
                      <dd>{selectedConnector ? formatConnectorLabel(selectedConnector) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Classes</dt>
                      <dd>{reviewCounts.classCount}</dd>
                    </div>
                    <div>
                      <dt>Object properties</dt>
                      <dd>{reviewCounts.objectPropertyCount}</dd>
                    </div>
                    <div>
                      <dt>Data properties</dt>
                      <dd>{reviewCounts.dataPropertyCount}</dd>
                    </div>
                    <div>
                      <dt>Validation status</dt>
                      <dd>{validationStatusLabel}</dd>
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
                  <h4>Ontology preview (TTL)</h4>
                  <pre className="ontology-wizard__source-preview">{reviewSourcePreview}</pre>
                </div>
              </div>

              <div className="ontology-wizard__what-happens">
                <h4>What will happen</h4>
                <ol>
                  {mode === "generate" ? (
                    <li>Continue to approval (draft and connector already saved)</li>
                  ) : (
                    <li>Create an ontology draft (no graph store write yet)</li>
                  )}
                  <li>Confirm validation and approve the draft</li>
                  <li>Materialize content through the selected graph store connector</li>
                  <li>Record semantic transactions and redirect to the transaction detail</li>
                </ol>
              </div>

              {backendValidationReport && (
                <>
                  <ValidationReportPanel report={backendValidationReport} />
                  {draftOntologyId && semanticReview && (
                    <SemanticReviewPanel
                      ontologyId={draftOntologyId}
                      review={semanticReview}
                      onReviewChange={setSemanticReview}
                      onError={setSubmitError}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {currentPhase === "finalize" && (
            <div className="ontologies-page__create-panel">
              <h3 className="ontologies-page__create-title">
                Step {stepNumber} · Approve & materialize
              </h3>
              <p className="ontology-wizard__panel-lead">
                Draft <strong>{title.trim()}</strong> is ready. Approve the ontology, then
                materialize it through the selected graph store connector.
              </p>

              <dl className="ontology-wizard__review-list">
                <div>
                  <dt>Draft ID</dt>
                  <dd>
                    <code>{draftOntologyId}</code>
                  </dd>
                </div>
                <div>
                  <dt>{GRAPH_STORE_CONNECTOR_LABEL}</dt>
                  <dd>{selectedConnector ? formatConnectorLabel(selectedConnector) : "—"}</dd>
                </div>
              </dl>

              {backendValidationReport && (
                <>
                  <ValidationReportPanel report={backendValidationReport} />
                  {draftOntologyId && semanticReview && (
                    <SemanticReviewPanel
                      ontologyId={draftOntologyId}
                      review={semanticReview}
                      onReviewChange={setSemanticReview}
                      onError={setSubmitError}
                    />
                  )}
                </>
              )}

              <div className="ontology-wizard__what-happens">
                <h4>What will happen</h4>
                <ol>
                  <li>Re-run validation on the stored draft</li>
                  <li>Mark the ontology as Validated and Approved</li>
                  <li>Materialize the artifact to the graph store connector</li>
                  <li>Record a semantic transaction (<code>ontology.materialized</code>)</li>
                </ol>
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
            {isGenerateSources && (
              <button type="button" onClick={() => void handleNext()} disabled={generating}>
                {generating ? "Generating…" : "Generate draft from sources"}
              </button>
            )}
            {isGenerateReview && (
              <button type="submit" disabled={submitting || !generateApproved}>
                {submitting ? "Saving…" : "Approve & continue"}
              </button>
            )}
            {!isGenerateSources && !isGenerateReview && !isLastStep && !isReviewStep && (
              <button
                type="button"
                onClick={() => void handleNext()}
                disabled={validationLoading || draftSaving}
              >
                {validationLoading ? "Validating…" : draftSaving ? "Saving…" : "Next"}
              </button>
            )}
            {!isGenerateSources && !isGenerateReview && isReviewStep && (
              <button type="submit" disabled={submitting || validationLoading}>
                {mode === "generate"
                  ? "Continue to approve"
                  : submitting
                    ? "Creating draft…"
                    : "Create draft & continue"}
              </button>
            )}
            {!isGenerateSources && !isGenerateReview && isLastStep && (
              <button
                type="submit"
                disabled={
                  submitting ||
                  validationLoading ||
                  !draftOntologyId ||
                  hasBlockingValidationErrors
                }
              >
                {submitting ? "Approving & materializing…" : "Approve & materialize"}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
