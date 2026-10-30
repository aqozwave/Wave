import { useCallback, useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { AppShell } from "./components/AppShell/AppShell";
import { PanelSkeleton } from "./components/PanelSkeleton/PanelSkeleton";
import { useAuth } from "./lib/auth/AuthContext";
import { useIdleTimeout } from "./lib/auth/useIdleTimeout";
import { ConfirmEmail } from "./pages/ConfirmEmail/ConfirmEmail";
import { ForgotPassword } from "./pages/ForgotPassword/ForgotPassword";
import { Login } from "./pages/Login/Login";
import { Catalogos } from "./pages/Catalogos/Catalogos";
import { Empresas } from "./pages/Empresas/Empresas";
import { Panel } from "./pages/Panel/Panel";
import { ResendConfirmation } from "./pages/ResendConfirmation/ResendConfirmation";
import { ResetPassword } from "./pages/ResetPassword/ResetPassword";
import { Roles } from "./pages/Roles/Roles";
import { Embarcados } from "./pages/Embarcados/Embarcados";
import { FichaTripulante } from "./pages/Embarcados/FichaTripulante";
import { Ubicaciones } from "./pages/Ubicaciones/Ubicaciones";
import { Usuarios } from "./pages/Usuarios/Usuarios";

/** Pantalla mínima mientras revive la cookie (evita blanco seco). */
function BootstrapSplash() {
  return (
    <div className="animate-fade flex h-full min-h-0 items-center justify-center bg-[var(--color-nachipa-bg-page)]">
      <div
        className="size-8 animate-shimmer rounded-full bg-[var(--color-nav-item-active-bg)]"
        aria-hidden
      />
      <span className="sr-only">Cargando sesión…</span>
    </div>
  );
}

/**
 * Exige access token y aplica idle 1h: sin actividad → logout + /login.
 * Espera el bootstrap (refresh por cookie) antes de mandar a /login en un F5.
 */
function RequireAuth() {
  const { accessToken, bootstrapped, logout } = useAuth();
  const navigate = useNavigate();

  /** Cierra sesión por inactividad (misma ruta que “Cerrar sesión”). */
  const onIdle = useCallback(() => {
    void (async () => {
      await logout();
      navigate("/login", { replace: true });
    })();
  }, [logout, navigate]);

  useIdleTimeout(Boolean(accessToken), onIdle);

  // Todavía intentando recuperar sesión desde la cookie refresh.
  if (!bootstrapped) {
    return <BootstrapSplash />;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

/**
 * Shell estable: el sidebar no se remonta al pasar de skeleton → contenido.
 * El main hace fade suave al cambiar de ruta.
 */
function ShellLayout() {
  const { hydrateSession } = useAuth();
  const location = useLocation();
  // false hasta completar la primera hidratación (evita flash del Panel).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await hydrateSession();
      if (!cancelled) {
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateSession]);

  return (
    <AppShell>
      {!ready ? (
        <PanelSkeleton />
      ) : (
        <div
          key={location.pathname}
          className="animate-fade flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <Outlet />
        </div>
      )}
    </AppShell>
  );
}

/** Rutas de la web: auth pública + panel protegido. */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/confirm-email" element={<ConfirmEmail />} />
      <Route path="/resend-confirmation" element={<ResendConfirmation />} />
      <Route element={<RequireAuth />}>
        <Route element={<ShellLayout />}>
          <Route index element={<Panel />} />
          <Route path="embarcados" element={<Embarcados />} />
          <Route path="embarcados/:id" element={<FichaTripulante />} />
          <Route
            path="tripulantes"
            element={<Navigate to="/embarcados" replace />}
          />
          <Route path="empresas" element={<Empresas />} />
          <Route path="ubicaciones" element={<Ubicaciones />} />
          <Route path="catalogos" element={<Catalogos />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="roles" element={<Roles />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
