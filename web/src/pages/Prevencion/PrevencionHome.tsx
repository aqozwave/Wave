import { useMemo } from "react";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  FileStack,
  GraduationCap,
  HardHat,
  Package,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { userHasPermission, type AuthUser } from "../../lib/api/auth";
import { useAuth } from "../../lib/auth/AuthContext";

/** Tarjeta del hub Prevención. */
type HubCard = {
  label: string;
  legend: string;
  icon: LucideIcon;
  to: string | null;
  canShow: (user: AuthUser | null) => boolean;
};

/** Grupo de módulos en la home. */
type HubGroup = {
  title: string;
  legend: string;
  items: HubCard[];
};

/**
 * Mapa del módulo Prevención (P1 catálogos + P2 orgs).
 * Habilitación / PT llegan en micro-pasos siguientes.
 */
const HUB_GROUPS: HubGroup[] = [
  {
    title: "Catálogos",
    legend: "Maestros por empresa para armar permisos de trabajo.",
    items: [
      {
        label: "Tipos de permiso",
        legend: "ALT, CAL, ECF… con criticidad, AST, exigencias y checklist.",
        icon: FileStack,
        to: "/prevencion/tipos",
        canShow: (u) => userHasPermission(u, "permit_types", "read"),
      },
      {
        label: "Capacitaciones",
        legend: "EXT-01, ODI-01, IND-SEG… vigencia y a quién aplican.",
        icon: GraduationCap,
        to: "/prevencion/capacitaciones",
        canShow: (u) => userHasPermission(u, "trainings", "read"),
      },
      {
        label: "Packs de habilitación",
        legend: "Qué documentos forman el pack empresa y el pack persona.",
        icon: Package,
        to: "/prevencion/packs",
        canShow: (u) =>
          userHasPermission(u, "maestros.document_types", "read"),
      },
    ],
  },
  {
    title: "Operación",
    legend: "Contratistas y flujos de emisión.",
    items: [
      {
        label: "Contratistas",
        legend: "Organizaciones externas del tenant (alta, ficha, estado).",
        icon: Building2,
        to: "/prevencion/contratistas",
        canShow: (u) => userHasPermission(u, "contractors", "read"),
      },
      {
        label: "Permisos de trabajo",
        legend: "Solicitar, validar y cerrar (flujo Estándar 5 etapas).",
        icon: ClipboardList,
        to: null,
        canShow: (u) => userHasPermission(u, "work_permits", "read"),
      },
    ],
  },
];

/**
 * Home del módulo Prevención.
 * Solo muestra tarjetas que el rol puede usar.
 */
export function PrevencionHome() {
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
        breadcrumb="Prevención"
        breadcrumbIcon={HardHat}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader
          crumbs={[{ label: "Prevención" }, { label: "Presentación" }]}
          title="Prevención de riesgos"
          description="Catálogos de tipos de permiso y capacitaciones. Los permisos de trabajo llegan en el siguiente slice."
        />

        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8">
          {groups.length === 0 ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              No tenés permisos de Prevención en este rol, o el módulo está
              apagado en la empresa.
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
