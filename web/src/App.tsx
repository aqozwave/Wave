import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router";
import { AppShell } from "./components/AppShell/AppShell";
import { PanelSkeleton } from "./components/PanelSkeleton/PanelSkeleton";
import { useAuth } from "./lib/auth/AuthContext";
import { useIdleTimeout } from "./lib/auth/useIdleTimeout";
import { ConfirmEmail } from "./pages/ConfirmEmail/ConfirmEmail";
import { ForgotPassword } from "./pages/ForgotPassword/ForgotPassword";
import { Login } from "./pages/Login/Login";
import { Empresas } from "./pages/Empresas/Empresas";
import { Panel } from "./pages/Panel/Panel";
import { ResendConfirmation } from "./pages/ResendConfirmation/ResendConfirmation";
import { ResetPassword } from "./pages/ResetPassword/ResetPassword";

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
    return null;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

/**
 * Shell del portal: al entrar (post-login) espera /me con skeleton
 * y recién entonces monta el Panel con animación de entrada.
 */
function ShellLayout() {
  const { hydrateSession } = useAuth();
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

  if (!ready) {
    return (
      <AppShell>
        <PanelSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="animate-enter flex min-h-0 min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
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
          <Route path="empresas" element={<Empresas />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
