import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { getHealth } from "../api";

interface AppShellProps {
  children: ReactNode;
}

type BackendConnectionStatus = "loading" | "connected" | "disconnected";

function connectionLabel(status: BackendConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Backend connected";
    case "disconnected":
      return "Backend disconnected";
    default:
      return "Checking backend…";
  }
}

export function AppShell({ children }: AppShellProps) {
  const [connectionStatus, setConnectionStatus] =
    useState<BackendConnectionStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((health) => {
        if (!cancelled) {
          setConnectionStatus(health.status === "ok" ? "connected" : "disconnected");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnectionStatus("disconnected");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__title">Semantic Intelligence Platform</span>
        </div>
        <div className="app-header__actions">
          <span
            className={`backend-status backend-status--${connectionStatus}`}
            role="status"
            aria-live="polite"
          >
            {connectionLabel(connectionStatus)}
          </span>
          <nav className="app-nav" aria-label="Primary">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `app-nav__link${isActive ? " app-nav__link--active" : ""}`
              }
            >
              Applications
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
