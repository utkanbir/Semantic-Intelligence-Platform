import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PlatformShell } from "./components/PlatformShell";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { AuditTracePage } from "./pages/platform/AuditTracePage";
import {
  AdaptersPageRedirect,
  ConnectorsPage,
  SemanticConnectorsPageRedirect,
} from "./pages/platform/ConnectorsPage";
import { GovernancePage } from "./pages/platform/GovernancePage";
import { PlatformHubPage } from "./pages/platform/PlatformHubPage";
import { PlatformOverviewPage } from "./pages/platform/PlatformOverviewPage";

export default function App() {
  return (
    <BrowserRouter>
      <PlatformShell>
        <Routes>
          <Route path="/" element={<PlatformOverviewPage />} />
          <Route path="/platform" element={<PlatformHubPage />} />
          <Route path="/connectors" element={<ConnectorsPage />} />
          <Route path="/adapters" element={<AdaptersPageRedirect />} />
          <Route path="/semantic-connectors" element={<SemanticConnectorsPageRedirect />} />
          <Route path="/governance" element={<GovernancePage />} />
          <Route path="/audit-trace" element={<AuditTracePage />} />
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
