import { Building2, ClipboardList, Users } from "lucide-react";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useAuth } from "../../lib/auth/AuthContext";

/** Capitaliza el primer carácter del nombre. */
function capitalizeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Home del contratista (Figma E3 · placeholder operativo).
 * Las rutas de habilitación / personal / permisos llegan con Prevención P2+.
 */
export function ContratistaHome() {
  const { user } = useAuth();
  const name = user ? capitalizeName(user.firstName) : "usuario";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar breadcrumb="Panel" actions={<UserMenu />} />
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5 lg:px-8">
        <div>
          <h1 className="m-0 text-[20px] font-semibold text-[var(--color-nachipa-title)]">
            Hola, {name}
          </h1>
          <p className="m-0 mt-1 text-[13px] text-[var(--color-nachipa-secondary)]">
            Portal del contratista · habilitación, personal y permisos de trabajo.
          </p>
        </div>

        <ul className="m-0 grid max-w-[720px] list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
          {[
            {
              icon: Building2,
              title: "Habilitación",
              legend: "Documentos de tu empresa y estado de revisión.",
            },
            {
              icon: Users,
              title: "Mi personal",
              legend: "Personas externas y documentos por persona.",
            },
            {
              icon: ClipboardList,
              title: "Permisos de trabajo",
              legend: "Completar, enviar y cerrar permisos a bordo.",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <li
                key={card.title}
                className="flex flex-col gap-2 rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-4"
              >
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  className="text-[var(--color-nav-icon)]"
                  aria-hidden
                />
                <p className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                  {card.title}
                </p>
                <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                  {card.legend}
                </p>
                <p className="m-0 text-[12px] font-medium text-[var(--color-nachipa-muted)]">
                  Próximamente
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
