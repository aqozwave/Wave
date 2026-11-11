import { useMemo } from "react";
import {
  Anchor,
  ArrowRight,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Ship,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { userHasPermission, type AuthUser } from "../../lib/api/auth";
import { useAuth } from "../../lib/auth/AuthContext";

/** Tarjeta del hub: link real o “próximamente”. */
type HubCard = {
  label: string;
  legend: string;
  icon: LucideIcon;
  to: string | null;
  /** Visibilidad según RBAC del usuario logueado. */
  canShow: (user: AuthUser | null) => boolean;
};

/** Grupo de módulos en la home de Cursos. */
type HubGroup = {
  title: string;
  legend: string;
  items: HubCard[];
};

/**
 * Mapa del módulo Cursos.
 * Catálogo y Embarcados son atajos (viven en Config / Tripulación);
 * el resto son pantallas propias. Cada tarjeta se filtra por permiso.
 */
const HUB_GROUPS: HubGroup[] = [
  {
    title: "Catálogo OMI",
    legend: "Qué cursos existen y cuáles exige cada título marítimo.",
    items: [
      {
        label: "Gestión de cursos",
        legend: "Catálogo OMI de la empresa (alta, edición, estado).",
        icon: BookOpen,
        to: "/catalogos?tab=courses",
        canShow: (u) => userHasPermission(u, "cursos.catalog", "read"),
      },
      {
        label: "Cursos por título marítimo",
        legend: "Obligatorios al asignar un título al tripulante.",
        icon: Anchor,
        to: "/catalogos?tab=certificates",
        canShow: (u) => userHasPermission(u, "maestros.certificates", "read"),
      },
    ],
  },
  {
    title: "Tripulación",
    legend: "Asignaciones y vigencia por persona.",
    items: [
      {
        label: "Embarcados",
        legend: "Ficha del tripulante → tab Cursos (asignar / editar).",
        icon: Ship,
        to: "/embarcados",
        canShow: (u) => userHasPermission(u, "embarcados", "read"),
      },
      {
        label: "Cursos de la tripulación",
        legend: "Vista masiva por tripulante (matriz).",
        icon: ClipboardList,
        to: "/cursos/tripulacion",
        canShow: (u) => userHasPermission(u, "cursos.assignments", "read"),
      },
      {
        label: "Vencimientos / libretas",
        legend: "Libretas y cursos vencidos o por vencer.",
        icon: GraduationCap,
        to: "/cursos/vencimientos",
        canShow: (u) => userHasPermission(u, "cursos.libretas", "read"),
      },
    ],
  },
];

/**
 * Home del módulo Cursos (shell).
 * Solo muestra tarjetas que el rol puede usar de verdad.
 */
export function CursosHome() {
  const { user } = useAuth();

  const groups = useMemo(() => {
    return HUB_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.canShow(user)),
    })).filter((group) => group.items.length > 0);
  }, [user]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Cursos"
        breadcrumbIcon={GraduationCap}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader
          crumbs={[{ label: "Cursos" }, { label: "Presentación" }]}
          title="Gestión de cursos"
          description="Formación OMI, títulos marítimos, asignaciones en ficha y avisos de vencimiento. Solo ves lo que tu rol permite."
        />

        {/* Header a la izquierda (ancho completo); solo el hub de tarjetas se centra. */}
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8">
          {groups.length === 0 ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              No tenés permisos de cursos en este rol.
            </p>
          ) : null}
          {groups.map((group) => (
            <section key={group.title} className="flex flex-col gap-3">
              <div>
                <h2 className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                  {group.title}
                </h2>
                <p className="m-0 mt-0.5 text-[13px] text-[var(--color-nachipa-secondary)]">
                  {group.legend}
                </p>
              </div>
              <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const body = (
                    <>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-nachipa-bg-page)] text-[var(--color-nachipa-primary)]">
                        <Icon size={18} strokeWidth={1.5} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                            {item.label}
                          </span>
                          {!item.to ? (
                            <span className="rounded-full bg-[var(--color-nachipa-bg-page)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-nachipa-secondary)]">
                              Próximamente
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-[var(--color-nachipa-secondary)]">
                          {item.legend}
                        </span>
                      </span>
                      {item.to ? (
                        <ArrowRight
                          className="size-4 shrink-0 text-[var(--color-nachipa-secondary)]"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      ) : null}
                    </>
                  );

                  const cardClass = [
                    "flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-4 text-left",
                    item.to
                      ? "transition-colors hover:border-[var(--color-nachipa-primary)] hover:bg-[var(--color-nachipa-bg-page)]"
                      : "opacity-70",
                  ].join(" ");

                  if (item.to) {
                    return (
                      <li key={item.label}>
                        <Link to={item.to} className={cardClass}>
                          {body}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={item.label}>
                      <div className={cardClass} title="Próximamente">
                        {body}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
