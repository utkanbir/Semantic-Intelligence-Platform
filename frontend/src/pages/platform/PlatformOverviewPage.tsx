import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api";
import { listApplications, type ApplicationResponse } from "../../api/applications";
import {
  HomeCompareSummary,
  HomeEntityPanel,
  applicationRows,
} from "../../components/home";
import {
  applicationStatusBadge,
  formatWorkspaceStack,
  sandboxStatusBadge,
  sortApplicationsByRecent,
} from "./homeUtils";

type HomeState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; applications: ApplicationResponse[] };

function sandboxCountLabel(count: number): string {
  return `${count} sandbox${count === 1 ? "" : ""}`;
}

function applicationCountLabel(count: number): string {
  return `${count} uygulama`;
}

export function PlatformOverviewPage() {
  const [state, setState] = useState<HomeState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    listApplications()
      .then((applications) => {
        if (!cancelled) {
          setState({ kind: "success", applications });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Uygulamalar yüklenemedi";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const applications =
    state.kind === "success" ? sortApplicationsByRecent(state.applications) : [];
  const count = applications.length;

  const sandboxRows = applicationRows(
    applications,
    sandboxStatusBadge,
    (application) => formatWorkspaceStack(application.workspace),
  );

  const appRows = applicationRows(
    applications,
    applicationStatusBadge,
    (application) => `Sandbox: ${application.name}`,
  );

  return (
    <section className="home-page" aria-labelledby="home-page-heading">
      <header className="home-page__header">
        <h1 id="home-page-heading" className="home-page__title">
          Semantic Intelligence Platform
        </h1>
        <div className="home-page__actions">
          <Link to="/applications?create=1" className="home-page__button home-page__button--primary">
            + Yeni sandbox
          </Link>
          <Link
            to="/applications?create=1"
            className="home-page__button home-page__button--secondary"
          >
            + Yeni uygulama
          </Link>
        </div>
      </header>

      {state.kind === "loading" && (
        <p className="home-page__status" role="status" aria-live="polite">
          Yükleniyor…
        </p>
      )}

      {state.kind === "error" && (
        <div className="home-page__error" role="alert">
          {state.message}
        </div>
      )}

      {state.kind !== "loading" && (
        <>
          <div className="home-page__columns">
            <HomeEntityPanel
              headingId="home-sandboxes-heading"
              title="Sandboxlar"
              summaryLine={`${sandboxCountLabel(count)} · altyapı ve bağlantı yapılandırması`}
              note="Chat, trace, compare mode burada çalışır"
              listHeading="Son kullanılan sandboxlar"
              rows={sandboxRows}
              emptyMessage="Henüz sandbox yok. Yeni sandbox oluşturarak başlayın."
            />

            <HomeEntityPanel
              headingId="home-applications-heading"
              title="Uygulamalar (App)"
              summaryLine={`${applicationCountLabel(count)} · bir Sandbox üzerine inşa edilir`}
              note="Discovery → Blueprint → çalışan uygulama"
              listHeading="Son kullanılan uygulamalar"
              rows={appRows}
              emptyMessage="Henüz uygulama yok. Yeni uygulama oluşturarak başlayın."
            />
          </div>

          <HomeCompareSummary />
        </>
      )}
    </section>
  );
}
