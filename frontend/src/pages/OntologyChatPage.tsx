import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api";
import { getSemanticTransaction, type SemanticTransactionResponse } from "../api/auditTrace";
import { askOntologyQuestion } from "../api/chat";
import {
  listOntologies,
  type OntologyDefinitionResponse,
} from "../api/ontologies";
import { OntologyAreaNav } from "../components/OntologyAreaNav";
import { SemanticTransactionTracePanel } from "../components/SemanticTransactionTracePanel";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; ontologies: OntologyDefinitionResponse[] };

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  semanticTransactionId?: string;
}

function pickPrimaryOntology(
  ontologies: OntologyDefinitionResponse[],
): OntologyDefinitionResponse | null {
  if (ontologies.length === 0) {
    return null;
  }

  const active = ontologies.filter((ontology) => ontology.status !== "Retired");
  const pool = active.length > 0 ? active : ontologies;

  return pool.reduce((best, current) =>
    current.version_number > best.version_number ? current : best,
  );
}

function sortOntologiesByTitle(
  ontologies: OntologyDefinitionResponse[],
): OntologyDefinitionResponse[] {
  return [...ontologies].sort((left, right) => left.title.localeCompare(right.title));
}

interface OntologyChatPageProps {
  applicationId: string;
}

export function OntologyChatPage({ applicationId }: OntologyChatPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [selectedOntologyId, setSelectedOntologyId] = useState("");
  const [question, setQuestion] = useState("");
  const [initiatedBy, setInitiatedBy] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ontologyError, setOntologyError] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [traceTransaction, setTraceTransaction] = useState<SemanticTransactionResponse | null>(
    null,
  );
  const [traceLoading, setTraceLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setState({ kind: "loading" });

    listOntologies(applicationId)
      .then((ontologies) => {
        if (!cancelled) {
          setState({ kind: "success", ontologies });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load ontologies";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const selectableOntologies = useMemo(() => {
    if (state.kind !== "success") {
      return [];
    }
    return sortOntologiesByTitle(
      state.ontologies.filter((ontology) => ontology.status !== "Retired"),
    );
  }, [state]);

  const primaryOntology = useMemo(
    () => (state.kind === "success" ? pickPrimaryOntology(state.ontologies) : null),
    [state],
  );

  useEffect(() => {
    if (selectableOntologies.length === 0) {
      setSelectedOntologyId("");
      return;
    }

    setSelectedOntologyId((current) => {
      if (current && selectableOntologies.some((ontology) => ontology.id === current)) {
        return current;
      }
      return primaryOntology?.id ?? selectableOntologies[0].id;
    });
  }, [primaryOntology, selectableOntologies]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!selectedOntologyId) {
      setOntologyError("Select an ontology");
      return;
    }
    setOntologyError(null);

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setQuestionError("Question is required");
      return;
    }
    setQuestionError(null);

    const userMessageId = `user-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: userMessageId, role: "user", content: trimmedQuestion },
    ]);
    setQuestion("");
    setSubmitting(true);
    setTraceLoading(true);
    setTraceTransaction(null);

    try {
      const initiatedByValue = initiatedBy.trim();
      const chatResponse = await askOntologyQuestion({
        ontology_id: selectedOntologyId,
        question: trimmedQuestion,
        ...(initiatedByValue ? { initiated_by: initiatedByValue } : {}),
      });

      const transaction = await getSemanticTransaction(chatResponse.semantic_transaction_id);
      setTraceTransaction(transaction);

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: chatResponse.answer,
          semanticTransactionId: chatResponse.semantic_transaction_id,
        },
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to ask ontology question";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
      setTraceLoading(false);
    }
  }

  const hasSelectableOntologies = selectableOntologies.length > 0;

  return (
    <section className="ontology-chat-page" aria-labelledby="ontology-chat-heading">
      <div className="ontology-chat-page__header">
        <div>
          <h2 id="ontology-chat-heading">Ontology chat</h2>
          <p className="ontology-chat-page__lead">
            Ask questions grounded in this application&apos;s ontology definitions. Each answer is
            traced as a semantic transaction.
          </p>
        </div>
      </div>

      <OntologyAreaNav applicationId={applicationId} />

      {state.kind === "loading" && (
        <p className="ontology-chat-page__status" role="status" aria-live="polite">
          Loading ontologies…
        </p>
      )}

      {state.kind === "error" && (
        <div className="ontology-chat-page__error" role="alert">
          {state.message}
        </div>
      )}

      {state.kind === "success" && !hasSelectableOntologies && (
        <div className="ontology-chat-page__empty" role="status">
          <p>No active ontologies are available for chat.</p>
          <p className="ontology-chat-page__hint">
            Create or import an ontology on the Definitions tab before asking questions.
          </p>
        </div>
      )}

      {state.kind === "success" && hasSelectableOntologies && (
        <div className="ontology-chat__layout">
          <div className="ontology-chat-page__main">
            <form
              className="ontology-chat-page__form"
              onSubmit={handleSubmit}
              noValidate
              aria-label="Ontology chat question"
            >
              <div className="ontology-chat-page__field">
                <label htmlFor="ontology-chat-ontology">Ontology</label>
                <select
                  id="ontology-chat-ontology"
                  name="ontology_id"
                  value={selectedOntologyId}
                  onChange={(event) => {
                    setSelectedOntologyId(event.target.value);
                    if (ontologyError) {
                      setOntologyError(null);
                    }
                  }}
                  aria-invalid={ontologyError ? true : undefined}
                  aria-describedby={ontologyError ? "ontology-chat-ontology-error" : undefined}
                  disabled={submitting}
                >
                  {selectableOntologies.map((ontology) => (
                    <option key={ontology.id} value={ontology.id}>
                      {ontology.title} (v{ontology.version_number})
                    </option>
                  ))}
                </select>
                {ontologyError && (
                  <p
                    id="ontology-chat-ontology-error"
                    className="ontology-chat-page__field-error"
                    role="alert"
                  >
                    {ontologyError}
                  </p>
                )}
              </div>

              {messages.length > 0 && (
                <div className="ontology-chat-page__messages" aria-label="Chat messages">
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={`ontology-chat-page__message ontology-chat-page__message--${message.role}`}
                    >
                      <h3 className="ontology-chat-page__message-role">
                        {message.role === "user" ? "You" : "Assistant"}
                      </h3>
                      <p className="ontology-chat-page__message-content">{message.content}</p>
                    </article>
                  ))}
                </div>
              )}

              <div className="ontology-chat-page__field">
                <label htmlFor="ontology-chat-question">Question</label>
                <textarea
                  id="ontology-chat-question"
                  name="question"
                  rows={4}
                  value={question}
                  onChange={(event) => {
                    setQuestion(event.target.value);
                    if (questionError) {
                      setQuestionError(null);
                    }
                  }}
                  aria-invalid={questionError ? true : undefined}
                  aria-describedby={questionError ? "ontology-chat-question-error" : undefined}
                  disabled={submitting}
                />
                {questionError && (
                  <p
                    id="ontology-chat-question-error"
                    className="ontology-chat-page__field-error"
                    role="alert"
                  >
                    {questionError}
                  </p>
                )}
              </div>

              <div className="ontology-chat-page__field">
                <label htmlFor="ontology-chat-initiated-by">
                  Initiated by <span className="ontology-chat-page__optional">(optional)</span>
                </label>
                <input
                  id="ontology-chat-initiated-by"
                  name="initiated_by"
                  type="text"
                  value={initiatedBy}
                  onChange={(event) => setInitiatedBy(event.target.value)}
                  disabled={submitting}
                />
              </div>

              {submitError && (
                <div className="ontology-chat-page__error" role="alert">
                  {submitError}
                </div>
              )}

              <div className="ontology-chat-page__form-actions">
                <button
                  type="submit"
                  className="ontology-chat-page__button ontology-chat-page__button--primary"
                  disabled={submitting}
                >
                  {submitting ? "Asking…" : "Ask question"}
                </button>
              </div>
            </form>
          </div>

          <SemanticTransactionTracePanel
            applicationId={applicationId}
            transaction={traceTransaction}
            loading={traceLoading}
          />
        </div>
      )}
    </section>
  );
}
