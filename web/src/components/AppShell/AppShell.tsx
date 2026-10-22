import type { ReactNode } from "react";
import { Sidebar } from "../Sidebar/Sidebar";

/** Props del layout principal del portal. */
type AppShellProps = {
  /** Contenido de la página (Panel, Empresas, …). */
  children: ReactNode;
};

/**
 * Shell del portal (Figma S1/S5): sidebar + main.
 * Sin padding propio: cada pantalla controla scroll y márgenes
 * (Empresas necesita Topbar a ancho completo sin desbordar).
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[var(--color-nachipa-bg-page)]">
      <Sidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
