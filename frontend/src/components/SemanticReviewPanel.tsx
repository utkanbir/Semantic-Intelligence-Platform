import { useState } from "react";
import { ApiError } from "../api";
import {
  recordSuggestionDecision,
  type OntologySemanticReview,
  type SemanticFindingKind,
  type SemanticReviewFinding,
  type SuggestionDecision,
} from "../api/ontologies";

interface SemanticReviewPanelProps {
  ontologyId: string;
  review: OntologySemanticReview;
  onReviewChange: (review: OntologySemanticReview) => void;
  onError?: (message: string) => void;
}

function formatKindLabel(kind: SemanticFindingKind): string {
  if (kind === "suggestion") {
    return "Suggestion";
  }
  if (kind === "warning") {
    return "Warning";
  }
  return "Improvement";
}

function formatDecisionLabel(decision: SuggestionDecision | null): string {
  if (decision === "accepted") {
    return "Accepted";
  }
  if (decision === "ignored") {
    return "Ignored";
  }
  return "Pending";
}

function FindingDecisionActions({
  finding,
  deciding,
  onAccept,
  onIgnore,
}: {
  finding: SemanticReviewFinding;
  deciding: boolean;
  onAccept: () => void;
  onIgnore: () => void;
}) {
  if (finding.kind !== "suggestion") {
    return null;
  }

  if (finding.decision === "accepted" || finding.decision === "ignored") {
    return (
      <span
        className={`ontology-wizard__semantic-decision ontology-wizard__semantic-decision--${finding.decision}`}
        role="status"
      >
        {formatDecisionLabel(finding.decision)}
      </span>
    );
  }

  return (
    <div className="ontology-wizard__semantic-actions">
      <button
        type="button"
        className="platform-page__button platform-table__action"
        disabled={deciding}
        onClick={onAccept}
        aria-label={`Accept suggestion: ${finding.title}`}
      >
        {deciding ? "Saving…" : "Accept"}
      </button>
      <button
        type="button"
        className="platform-page__button platform-table__action"
        disabled={deciding}
        onClick={onIgnore}
        aria-label={`Ignore suggestion: ${finding.title}`}
      >
        Ignore
      </button>
    </div>
  );
}

export function SemanticReviewPanel({
  ontologyId,
  review,
  onReviewChange,
  onError,
}: SemanticReviewPanelProps) {
  const [decidingFindingId, setDecidingFindingId] = useState<string | null>(null);

  async function handleDecision(findingId: string, decision: SuggestionDecision) {
    setDecidingFindingId(findingId);
    try {
      const response = await recordSuggestionDecision(ontologyId, findingId, { decision });
      onReviewChange(response.semantic_review);
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to record suggestion decision";
      onError?.(message);
    } finally {
      setDecidingFindingId(null);
    }
  }

  if (!review.available) {
    return (
      <div className="ontology-wizard__review-card ontology-wizard__semantic-review" role="status">
        <h4>Advisory semantic review</h4>
        <p className="ontology-wizard__hint">
          Advisory semantic review is unavailable — structural validation results are shown above.
          Advisory suggestions will appear here when the review service is enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="ontology-wizard__review-card ontology-wizard__semantic-review">
      <h4>Advisory semantic review</h4>
      <p>
        Advisory findings from the semantic review — separate from deterministic structural
        checks. Accept or ignore suggestions to record your decision; the draft is not modified.
      </p>
      {review.model && (
        <p className="ontology-wizard__hint">
          Model: <code>{review.model}</code>
        </p>
      )}
      {review.summary && <p className="ontology-wizard__hint">{review.summary}</p>}

      {review.findings.length === 0 ? (
        <p className="ontology-wizard__hint" role="status">
          No semantic review findings for this ontology.
        </p>
      ) : (
        <ul className="ontology-wizard__semantic-findings" aria-label="Semantic review findings">
          {review.findings.map((finding) => (
            <li
              key={finding.id}
              className={`ontology-wizard__semantic-finding ontology-wizard__semantic-finding--${finding.kind}${
                finding.decision ? ` ontology-wizard__semantic-finding--${finding.decision}` : ""
              }`}
            >
              <div className="ontology-wizard__semantic-finding-header">
                <span className="ontology-wizard__semantic-kind">{formatKindLabel(finding.kind)}</span>
                {finding.kind !== "suggestion" && finding.decision && (
                  <span className="ontology-wizard__semantic-decision" role="status">
                    {formatDecisionLabel(finding.decision)}
                  </span>
                )}
              </div>
              <p className="ontology-wizard__semantic-title">{finding.title}</p>
              {finding.detail && <p className="ontology-wizard__semantic-detail">{finding.detail}</p>}
              {finding.target && (
                <p className="ontology-wizard__semantic-target">
                  Target: <code>{finding.target}</code>
                </p>
              )}
              <FindingDecisionActions
                finding={finding}
                deciding={decidingFindingId === finding.id}
                onAccept={() => void handleDecision(finding.id, "accepted")}
                onIgnore={() => void handleDecision(finding.id, "ignored")}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
