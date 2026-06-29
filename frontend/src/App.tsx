import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<ApplicationsPage />} />
          <Route
            path="/applications/:applicationId/*"
            element={<ApplicationDetailPage />}
          />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
