import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { importOntology } from "../api/ontologies";
import {
  listSemanticConnectors,
  type SemanticConnectorResponse,
} from "../api/semanticConnectors";

interface OntologyStudioPageProps {
  applicationId: string;
}

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; connectors: SemanticConnectorResponse[] }
  | { kind: "imported"; ontologyId: string; artifactUri: string | null | undefined };

export function OntologyStudioPage({ applicationId }: OntologyStudioPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [title, setTitle] = useState("");
  const [connectorId, setConnectorId] = useState("");
  const [sourceFormat, setSourceFormat] = useState("owl");
  const [sourceContent, setSourceContent] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listSemanticConnectors({ connectorType: "ontology_store", activeOnly: true })
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const trimmedTitle = title.trim();
    const trimmedContent = sourceContent.trim();
    if (!trimmedTitle || !connectorId || !trimmedContent) {
      setSubmitError("Title, connector, and OWL content are required");
      return;
    }

    setSubmitting(true);
    try {
      const createdByValue = createdBy.trim();
      const ontology = await importOntology({
        application_id: applicationId,
        title: trimmedTitle,
        semantic_connector_id: connectorId,
        source_format: sourceFormat.trim() || "owl",
        source_content: trimmedContent,
        ...(createdByValue ? { created_by: createdByValue } : {}),
      });
      setState({
        kind: "imported",
        ontologyId: ontology.id,
        artifactUri: ontology.artifact_uri,
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

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    void file.text().then((text) => {
      setSourceContent(text);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, ""));
      }
    });
  }

  if (state.kind === "loading") {
    return (
      <p className="agent-runs-page__status" role="status">
        Loading Ontology Studio…
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
        <h2 id="ontology-studio-heading">Ontology Studio</h2>
        <div className="agent-runs-page__empty" role="status">
          <p>Ontology imported successfully.</p>
          {state.artifactUri && (
            <p>
              Artifact URI: <code>{state.artifactUri}</code>
            </p>
          )}
          <p>
            <Link to={`../ontology`}>View ontologies</Link> ·{" "}
            <Link to={`../audit-trace`}>View semantic transactions</Link>
          </p>
        </div>
      </section>
    );
  }

  const { connectors } = state;

  return (
    <section className="agent-runs-page" aria-labelledby="ontology-studio-heading">
      <div className="agent-runs-page__header">
        <div>
          <h2 id="ontology-studio-heading">Ontology Studio</h2>
          <p className="agent-runs-page__lead">
            Import OWL content through a platform semantic connector. Each import creates a
            SemanticTransaction with trace steps visible in Audit trace.
          </p>
        </div>
      </div>

      {connectors.length === 0 ? (
        <div className="agent-runs-page__empty" role="status">
          <p>
            No active ontology_store connectors. Create one under Platform → Semantic Connectors
            (requires an Active MinIO adapter).
          </p>
        </div>
      ) : (
        <form
          className="platform-page__create-form"
          onSubmit={(event) => void handleSubmit(event)}
          aria-label="Import ontology"
        >
          <div className="platform-page__field">
            <label htmlFor="ontology-import-title">Title</label>
            <input
              id="ontology-import-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="platform-page__field">
            <label htmlFor="ontology-import-connector">Semantic connector</label>
            <select
              id="ontology-import-connector"
              value={connectorId}
              onChange={(event) => setConnectorId(event.target.value)}
            >
              {connectors.map((connector) => (
                <option key={connector.id} value={connector.id}>
                  {connector.title} ({connector.connector_key})
                </option>
              ))}
            </select>
          </div>
          <div className="platform-page__field">
            <label htmlFor="ontology-import-format">Source format</label>
            <input
              id="ontology-import-format"
              value={sourceFormat}
              onChange={(event) => setSourceFormat(event.target.value)}
            />
          </div>
          <div className="platform-page__field">
            <label htmlFor="ontology-import-file">OWL file</label>
            <input
              id="ontology-import-file"
              type="file"
              accept=".owl,.xml,.ttl,.rdf,text/plain,application/xml"
              onChange={handleFileChange}
            />
          </div>
          <div className="platform-page__field">
            <label htmlFor="ontology-import-content">OWL content</label>
            <textarea
              id="ontology-import-content"
              rows={12}
              value={sourceContent}
              onChange={(event) => setSourceContent(event.target.value)}
            />
          </div>
          <div className="platform-page__field">
            <label htmlFor="ontology-import-created-by">Created by</label>
            <input
              id="ontology-import-created-by"
              value={createdBy}
              onChange={(event) => setCreatedBy(event.target.value)}
            />
          </div>
          {submitError && (
            <div className="agent-runs-page__error" role="alert">
              {submitError}
            </div>
          )}
          <div className="platform-page__form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Importing…" : "Import ontology"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
