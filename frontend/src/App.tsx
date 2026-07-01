import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PlatformShell } from "./components/PlatformShell";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { PlatformOverviewPage } from "./pages/platform/PlatformOverviewPage";
import { PlatformPlaceholderPage } from "./pages/platform/PlatformPlaceholderPage";

export default function App() {
  return (
    <BrowserRouter>
      <PlatformShell>
        <Routes>
          <Route path="/" element={<PlatformOverviewPage />} />
          <Route
            path="/adapters"
            element={
              <PlatformPlaceholderPage
                title="Adapters"
                description="Configure and monitor technology adapters that connect the platform to external systems."
              />
            }
          />
          <Route
            path="/governance"
            element={
              <PlatformPlaceholderPage
                title="Governance"
                description="Review policies, approvals, and platform-wide governance controls."
              />
            }
          />
          <Route
            path="/audit-trace"
            element={
              <PlatformPlaceholderPage
                title="Audit trace"
                description="Browse semantic transactions and trace steps across the platform."
              />
            }
          />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route
            path="/applications/:applicationId/*"
            element={<ApplicationDetailPage />}
          />
        </Routes>
      </PlatformShell>
    </BrowserRouter>
  );
}
