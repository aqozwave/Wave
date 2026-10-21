import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { AuthProvider } from "./lib/auth/AuthContext";
import "./index.css";

/** Contenedor React montado por Vite en index.html. */
const root = document.getElementById("root");

if (!root) {
  throw new Error("No se encontró #root");
}

// Router + Auth envuelven toda la app (login y shell protegido).
createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
