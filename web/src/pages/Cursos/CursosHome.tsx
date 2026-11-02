import {
  Anchor,
  ArrowRight,
  Bell,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Inbox,
  Ship,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";

/** Tarjeta del hub: link real o “próximamente”. */
type HubCard = {
  label: string;
  legend: string;
  icon: LucideIcon;
  to: string | null;
};

/** Grupo de módulos en la home de Cursos. */
type HubGroup = {
  title: string;
  legend: string;
  items: HubCard[];
};

/**
 * Mapa del módulo Cursos: enlaza a pantallas ya hechas
 * y marca lo que aún no tiene ruta propia.
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
      },
      {
        label: "Cursos por título marítimo",
        legend: "Obligatorios al asignar un título al tripulante.",
        icon: Anchor,
        to: "/catalogos?tab=certificates",
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
      },
      {
        label: "Cursos de la tripulación",
        legend: "Vista masiva por tripulante (matriz).",
        icon: ClipboardList,
        to: null,
      },
      {
        label: "Vencimientos / libretas",
        legend: "Libretas y cursos vencidos o por vencer.",
        icon: GraduationCap,
        to: "/cursos/vencimientos",
      },
    ],
  },
  {
    title: "Avisos",
    legend: "Hitos y cola de envío (override de prueba activo).",
    items: [
      {
        label: "Notificaciones de vencimiento",
        legend: "Días de aviso al tripulante y resumen admin.",
        icon: Bell,
        to: "/notificaciones",
      },
      {
        label: "Outbox",
        legend: "Cola pending / sent / failed y reintentos.",
        icon: Inbox,
        to: "/notificaciones/outbox",
      },
    ],
  },
];

/**
 * Home del módulo Cursos (shell).
 * No inventa pantallas nuevas: apunta a lo existente o marca “Próximamente”.
 */
export function CursosHome() {
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
          description="Formación OMI, títulos marítimos, asignaciones en ficha y avisos de vencimiento. Las pantallas operativas grandes llegan después; acá entrás a lo que ya está listo."
        />

        <div className="flex max-w-[960px] flex-col gap-8">
          {HUB_GROUPS.map((group) => (
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
