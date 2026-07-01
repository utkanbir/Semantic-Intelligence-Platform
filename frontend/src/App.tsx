import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PlatformShell } from "./components/PlatformShell";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { AdaptersPage } from "./pages/platform/AdaptersPage";
import { AuditTracePage } from "./pages/platform/AuditTracePage";
import { GovernancePage } from "./pages/platform/GovernancePage";
import { PlatformOverviewPage } from "./pages/platform/PlatformOverviewPage";

export default function App() {
  return (
    <BrowserRouter>
      <PlatformShell>
        <Routes>
          <Route path="/" element={<PlatformOverviewPage />} />
          <Route path="/adapters" element={<AdaptersPage />} />
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
