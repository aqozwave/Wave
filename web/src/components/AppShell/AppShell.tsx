import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Sidebar } from "../Sidebar/Sidebar";
import { Topbar } from "../Topbar/Topbar";

type AppShellProps = {
  breadcrumb: string;
  breadcrumbIcon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  breadcrumb,
  breadcrumbIcon,
  actions,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-full min-h-0 bg-[var(--color-nachipa-bg-page)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          breadcrumb={breadcrumb}
          breadcrumbIcon={breadcrumbIcon}
          actions={actions}
        />
        <div className="min-h-0 flex-1 overflow-auto px-8 py-7">{children}</div>
      </div>
    </div>
  );
}
