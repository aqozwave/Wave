import type { ReactNode } from "react";
import { Sidebar } from "../Sidebar/Sidebar";

/** Props del layout principal del portal. */
type AppShellProps = {
  /** Contenido de la página (Panel, Empresas, …). */
  children: ReactNode;
};

/**
 * Shell del portal (Figma S1): sidebar + área main.
 * El header de página (Bienvenido / acciones) vive dentro de cada pantalla.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-full min-h-0 bg-[var(--color-nachipa-bg-page)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto px-7 py-[22px]">
          {children}
        </div>
      </div>
    </div>
  );
}
