import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import {
  runOntologyValidation,
  updateOntologyStatus,
  type OntologyDefinitionStatus,
  type OntologyValidationReport,
} from "../api/ontologies";
import { OntologyValidationInventoryView } from "../components/OntologyValidationInventory";

interface OntologyValidationPageProps {
  applicationId: string;
  ontologyId: string;
}

type GovernancePhase = "draft" | "validated";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "review";
      report: OntologyValidationReport;
      ontologyTitle: string;
      governancePhase: GovernancePhase;
    }
  | { kind: "approved"; ontologyTitle: string; approvedAt: string | null };

function groupFindings(report: OntologyValidationReport) {
  return {
    errors: report.findings.filter((finding) => finding.level === "error"),
    warnings: report.findings.filter((finding) => finding.level === "warning"),
    info: report.findings.filter((finding) => finding.level === "info"),
  };
}

function governancePhaseForStatus(status: OntologyDefinitionStatus): GovernancePhase | "approved" {
  if (status === "Validated") {
    return "validated";
  }
  if (status === "Approved") {
    return "approved";
  }
  return "draft";
}

export function OntologyValidationPage({
  applicationId,
  ontologyId,
}: OntologyValidationPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    runOntologyValidation(ontologyId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        const phase = governancePhaseForStatus(result.ontology.status);
        if (phase === "approved") {
          setState({
            kind: "approved",
            ontologyTitle: result.ontology.title,
            approvedAt: result.ontology.approved_at,
          });
          return;
        }

        setState({
          kind: "review",
          report: result.report,
          ontologyTitle: result.ontology.title,
          governancePhase: phase,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to run ontology validation";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ontologyId]);

  const grouped = useMemo(() => {
    if (state.kind !== "review") {
      return null;
    }
    return groupFindings(state.report);
  }, [state]);

  async function handleConfirm() {
    if (state.kind !== "review" || state.governancePhase !== "draft" || !state.report.passed) {
      return;
    }

    setActionError(null);
    setConfirming(true);
    try {
      await updateOntologyStatus(ontologyId, "Validated");
      setState({
        kind: "review",
        report: state.report,
        ontologyTitle: state.ontologyTitle,
        governancePhase: "validated",
      });
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to confirm validation";
      setActionError(message);
    } finally {
      setConfirming(false);
    }
  }

  async function handleApprove() {
    if (state.kind !== "review" || state.governancePhase !== "validated" || !state.report.passed) {
      return;
    }

    setActionError(null);
    setApproving(true);
    try {
      const updated = await updateOntologyStatus(ontologyId, "Approved");
      setState({
        kind: "approved",
        ontologyTitle: updated.title,
        approvedAt: updated.approved_at,
      });
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to approve ontology";
      setActionError(message);
    } finally {
      setApproving(false);
    }
  }

  const ontologyPath = `/applications/${applicationId}/ontology`;
  const governancePhase = state.kind === "review" ? state.governancePhase : null;

  return (
    <section className="ontology-validation-page" aria-labelledby="ontology-validation-heading">
      <div className="ontology-validation-page__header">
        <div>
          <h2 id="ontology-validation-heading">Ontology validation</h2>
          <p className="ontology-validation-page__lead">
            {governancePhase === "validated"
              ? "Structural validation is complete. Review the report and approve this ontology for governance."
              : "Review structural checks and advisory feedback, then confirm validation and approve for governance."}
          </p>
        </div>
        <Link to={ontologyPath} className="ontologies-page__button ontologies-page__button--secondary">
          Back to ontology
        </Link>
      </div>

      {state.kind === "loading" && (
        <p className="ontologies-page__status" role="status" aria-live="polite">
          Running validation…
        </p>
      )}

      {state.kind === "error" && (
        <div className="ontologies-page__error" role="alert">
          {state.message}
        </div>
      )}

      {state.kind === "approved" && (
        <div className="ontology-validation-page__success" role="status">
          <p>Ontology approved.</p>
          {state.approvedAt && (
            <p className="ontology-validation-page__muted">
              Approved at {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(state.approvedAt))}
            </p>
          )}
          <Link to={ontologyPath} className="ontologies-page__inline-link">
            Return to ontology
          </Link>
        </div>
      )}

      {state.kind === "review" && grouped && (
        <>
          {state.governancePhase === "validated" && (
            <div className="ontology-validation-page__success" role="status">
              <p>Ontology marked as Validated.</p>
            </div>
          )}

          <div className="ontology-validation-page__summary">
            <h3>{state.ontologyTitle}</h3>
            <p>
              {state.report.passed ? "Structural validation passed" : "Structural validation failed"}
              {" · "}
              {state.report.error_count} errors, {state.report.warning_count} warnings
            </p>
          </div>

          {grouped.errors.length > 0 && (
            <section className="ontology-validation-page__section" aria-labelledby="validation-errors">
              <h4 id="validation-errors">Errors</h4>
              <ul>
                {grouped.errors.map((finding) => (
                  <li key={`${finding.code}-${finding.message}`}>{finding.message}</li>
                ))}
              </ul>
            </section>
          )}

          {grouped.warnings.length > 0 && (
            <section className="ontology-validation-page__section" aria-labelledby="validation-warnings">
              <h4 id="validation-warnings">Warnings</h4>
              <ul>
                {grouped.warnings.map((finding) => (
                  <li key={`${finding.code}-${finding.message}`}>{finding.message}</li>
                ))}
              </ul>
            </section>
          )}

          {grouped.info.length > 0 && (
            <section className="ontology-validation-page__section" aria-labelledby="validation-info">
              <h4 id="validation-info">Checks</h4>
              <ul>
                {grouped.info.map((finding) => (
                  <li key={`${finding.code}-${finding.message}`}>{finding.message}</li>
                ))}
              </ul>
            </section>
          )}

          <OntologyValidationInventoryView inventory={state.report.inventory} />

          <section className="ontology-validation-page__section" aria-labelledby="validation-ai">
            <h4 id="validation-ai">AI advisory</h4>
            {state.report.ai_summary ? (
              <p>{state.report.ai_summary}</p>
            ) : (
              <p className="ontology-validation-page__muted">
                AI review unavailable — structural checks only.
              </p>
            )}
          </section>

          {actionError && (
            <div className="ontologies-page__error" role="alert">
              {actionError}
            </div>
          )}

          <div className="platform-page__form-actions">
            <Link to={ontologyPath} className="ontologies-page__button ontologies-page__button--secondary">
              Back to ontology
            </Link>
            {state.governancePhase === "draft" && (
              <button
                type="button"
                className="ontologies-page__button ontologies-page__button--primary"
                disabled={!state.report.passed || confirming}
                onClick={() => void handleConfirm()}
              >
                {confirming ? "Confirming…" : "Confirm validation"}
              </button>
            )}
            {state.governancePhase === "validated" && (
              <button
                type="button"
                className="ontologies-page__button ontologies-page__button--primary"
                disabled={!state.report.passed || approving}
                onClick={() => void handleApprove()}
              >
                {approving ? "Approving…" : "Approve ontology"}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
