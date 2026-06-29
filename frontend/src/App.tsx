import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ApplicationsPage } from "./pages/ApplicationsPage";

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<ApplicationsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
