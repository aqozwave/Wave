import { LayoutDashboard } from "lucide-react";
import { Navigate, Outlet, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell/AppShell";
import { HealthStatus } from "./components/HealthStatus/HealthStatus";
import { useAuth } from "./lib/auth/AuthContext";
import { Login } from "./pages/Login/Login";
import { Panel } from "./pages/Panel/Panel";

function RequireAuth() {
  const { accessToken } = useAuth();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function ShellLayout() {
  return (
    <AppShell
      breadcrumb="Panel global"
      breadcrumbIcon={LayoutDashboard}
      actions={<HealthStatus />}
    >
      <Outlet />
    </AppShell>
  );
}

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
