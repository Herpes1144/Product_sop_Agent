import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppNav } from "./components/AppNav";
import { ClientPage } from "./components/ClientPage";
import { WorkbenchPage } from "./components/WorkbenchPage";
import { SandboxProvider } from "./lib/sandbox-context";

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <SandboxProvider>
        <div className="root-shell">
          <AppNav />
          <Routes>
            <Route path="/" element={<Navigate to="/client" replace />} />
            <Route path="/client" element={<ClientPage />} />
            <Route path="/workbench" element={<WorkbenchPage />} />
          </Routes>
        </div>
      </SandboxProvider>
    </BrowserRouter>
  );
}
