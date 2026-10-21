import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router";
import { AppShell } from "./components/AppShell/AppShell";
import { PanelSkeleton } from "./components/PanelSkeleton/PanelSkeleton";
import { useAuth } from "./lib/auth/AuthContext";
import { useIdleTimeout } from "./lib/auth/useIdleTimeout";
import { Login } from "./pages/Login/Login";
import { Panel } from "./pages/Panel/Panel";

/**
 * Exige access token y aplica idle 1h: sin actividad → logout + /login.
 */
function RequireAuth() {
  const { accessToken, logout } = useAuth();
  const navigate = useNavigate();

  /** Cierra sesión por inactividad (misma ruta que “Cerrar sesión”). */
  const onIdle = useCallback(() => {
    void (async () => {
      await logout();
      navigate("/login", { replace: true });
    })();
  }, [logout, navigate]);

  useIdleTimeout(Boolean(accessToken), onIdle);

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
      <div className="animate-enter">
        <Outlet />
      </div>
    </AppShell>
  );
}

/** Rutas de la web: login público + panel protegido. */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<ShellLayout />}>
          <Route index element={<Panel />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
