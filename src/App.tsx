import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppNav } from "./components/AppNav";
import { ClientPage } from "./components/ClientPage";
import { WorkbenchPage } from "./components/WorkbenchPage";
import { SandboxProvider } from "./lib/sandbox-context";

function ScrollToTopOnRouteChange() {
  const { pathname } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
      // jsdom does not implement window.scrollTo; browsers do.
    }
  }, [pathname]);

  return null;
}

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
          <ScrollToTopOnRouteChange />
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
