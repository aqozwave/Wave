import { LayoutDashboard } from "lucide-react";
import { AppShell } from "./components/AppShell/AppShell";
import { HealthStatus } from "./components/HealthStatus/HealthStatus";
import { Panel } from "./pages/Panel/Panel";

export function App() {
  return (
    <AppShell
      breadcrumb="Panel global"
      breadcrumbIcon={LayoutDashboard}
      actions={<HealthStatus />}
    >
      <Panel />
    </AppShell>
  );
}
