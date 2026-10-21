import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { ToastProvider } from "./components/Toast/ToastProvider";
import { AuthProvider } from "./lib/auth/AuthContext";
import "./index.css";

/** Contenedor React montado por Vite en index.html. */
const root = document.getElementById("root");

if (!root) {
  throw new Error("No se encontró #root");
}

// Router + Auth + Toast (notificaciones in-app).
createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
