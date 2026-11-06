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
import { CursosHome } from "./pages/Cursos/CursosHome";
import { CursosTripulacion } from "./pages/Cursos/CursosTripulacion";
import { Vencimientos } from "./pages/Cursos/Vencimientos";
import { Empresas } from "./pages/Empresas/Empresas";
import { ContractorPortalAccreditationPage } from "./pages/Home/ContractorPortalAccreditationPage";
import { ContractorPortalPeoplePage } from "./pages/Home/ContractorPortalPeoplePage";
import { ContractorPortalPermitsPage } from "./pages/Home/ContractorPortalPermitsPage";
import { HomeIndex } from "./pages/Home/HomeIndex";
import { ResendConfirmation } from "./pages/ResendConfirmation/ResendConfirmation";
import { ResetPassword } from "./pages/ResetPassword/ResetPassword";
import { Roles } from "./pages/Roles/Roles";
import { ActivityLogs } from "./pages/Sistema/ActivityLogs";
import { Embarcados } from "./pages/Embarcados/Embarcados";
import { FichaTripulante } from "./pages/Embarcados/FichaTripulante";
import { NotificacionesVencimiento } from "./pages/Notificaciones/NotificacionesVencimiento";
import { OutboxNotificaciones } from "./pages/Notificaciones/OutboxNotificaciones";
import { AccreditationDetailPage } from "./pages/Prevencion/AccreditationDetailPage";
import { AccreditationPacksPage } from "./pages/Prevencion/AccreditationPacksPage";
import { AccreditationsPage } from "./pages/Prevencion/AccreditationsPage";
import { ContractorDetailPage } from "./pages/Prevencion/ContractorDetailPage";
import { ContractorsPage } from "./pages/Prevencion/ContractorsPage";
import { PermitTypeDetailPage } from "./pages/Prevencion/PermitTypeDetailPage";
import { PermitTypesPage } from "./pages/Prevencion/PermitTypesPage";
import { PrevencionHome } from "./pages/Prevencion/PrevencionHome";
import { TrainingsPage } from "./pages/Prevencion/TrainingsPage";
import { WorkNoticesPage } from "./pages/Prevencion/WorkNoticesPage";
import { WorkPermitsPage } from "./pages/Prevencion/WorkPermitsPage";
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
          <Route index element={<HomeIndex />} />
          <Route
            path="portal/habilitacion"
            element={<ContractorPortalAccreditationPage />}
          />
          <Route
            path="portal/personal"
            element={<ContractorPortalPeoplePage />}
          />
          <Route
            path="portal/permisos"
            element={<ContractorPortalPermitsPage />}
          />
          <Route path="embarcados" element={<Embarcados />} />
          <Route path="embarcados/:id" element={<FichaTripulante />} />
          <Route
            path="tripulantes"
            element={<Navigate to="/embarcados" replace />}
          />
          <Route path="cursos" element={<CursosHome />} />
          <Route path="cursos/tripulacion" element={<CursosTripulacion />} />
          <Route path="cursos/vencimientos" element={<Vencimientos />} />
          <Route path="prevencion" element={<PrevencionHome />} />
          <Route path="prevencion/tipos" element={<PermitTypesPage />} />
          <Route
            path="prevencion/tipos/:id"
            element={<PermitTypeDetailPage />}
          />
          <Route
            path="prevencion/capacitaciones"
            element={<TrainingsPage />}
          />
          <Route
            path="prevencion/packs"
            element={<AccreditationPacksPage />}
          />
          <Route
            path="prevencion/contratistas"
            element={<ContractorsPage />}
          />
          <Route
            path="prevencion/contratistas/:id"
            element={<ContractorDetailPage />}
          />
          <Route
            path="prevencion/habilitaciones"
            element={<AccreditationsPage />}
          />
          <Route
            path="prevencion/habilitaciones/:id"
            element={<AccreditationDetailPage />}
          />
          <Route
            path="prevencion/avisos"
            element={<WorkNoticesPage />}
          />
          <Route
            path="prevencion/permisos"
            element={<WorkPermitsPage />}
          />
          <Route path="empresas" element={<Empresas />} />
          <Route path="ubicaciones" element={<Ubicaciones />} />
          <Route path="catalogos" element={<Catalogos />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="notificaciones" element={<NotificacionesVencimiento />} />
          <Route
            path="notificaciones/outbox"
            element={<OutboxNotificaciones />}
          />
          <Route path="roles" element={<Roles />} />
          <Route path="sistema/actividad" element={<ActivityLogs />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
