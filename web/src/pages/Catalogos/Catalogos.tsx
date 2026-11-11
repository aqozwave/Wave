import { useEffect, useRef, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { useSearchParams } from "react-router";
import { Button } from "../../components/Button/Button";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { userHasPermission } from "../../lib/api/auth";
import { useAuth } from "../../lib/auth/AuthContext";
import {
  CertificatesPanel,
  type CertificatesPanelHandle,
} from "./CertificatesPanel";
import { CoursesPanel, type CoursesPanelHandle } from "./CoursesPanel";
import { DegreesPanel, type DegreesPanelHandle } from "./DegreesPanel";
import {
  DocumentTypesPanel,
  type DocumentTypesPanelHandle,
} from "./DocumentTypesPanel";
import { RanksPanel, type RanksPanelHandle } from "./RanksPanel";

/** Tabs activos de Catálogos maestros. */
type CatalogTab =
  | "ranks"
  | "degrees"
  | "certificates"
  | "courses"
  | "documentTypes";

/** Tabs válidos para deep-link ?tab= (hub Cursos). */
const CATALOG_TABS = new Set<CatalogTab>([
  "ranks",
  "degrees",
  "certificates",
  "courses",
  "documentTypes",
]);

/** Interpreta ?tab= del query; default ranks. */
function tabFromSearch(raw: string | null): CatalogTab {
  if (raw && CATALOG_TABS.has(raw as CatalogTab)) {
    return raw as CatalogTab;
  }
  return "ranks";
}

/**
 * Pantalla Catálogos maestros.
 * Rangos, títulos, cursos y tipos de documento del expediente.
 * Soporta ?tab=courses|certificates|… desde el hub de Cursos.
 */
export function Catalogos() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<CatalogTab>(() =>
    tabFromSearch(searchParams.get("tab")),
  );
  /** Alta del catálogo del tab activo (botón Nuevo del header). */
  const canCreate =
    tab === "ranks"
      ? userHasPermission(user, "maestros.ranks", "create")
      : tab === "degrees"
        ? userHasPermission(user, "maestros.degrees", "create")
        : tab === "certificates"
          ? userHasPermission(user, "maestros.certificates", "create")
          : tab === "courses"
            ? userHasPermission(user, "cursos.catalog", "create")
            : userHasPermission(user, "maestros.document_types", "create");

  /** Sincroniza tab si cambia la URL (link desde /cursos). */
  useEffect(() => {
    setTab(tabFromSearch(searchParams.get("tab")));
  }, [searchParams]);

  /** Cambia tab y refleja en la URL (sin perder historial inútil). */
  function selectTab(next: CatalogTab) {
    setTab(next);
    setSearchParams(next === "ranks" ? {} : { tab: next }, { replace: true });
  }
  const ranksPanelRef = useRef<RanksPanelHandle>(null);
  const degreesPanelRef = useRef<DegreesPanelHandle>(null);
  const certificatesPanelRef = useRef<CertificatesPanelHandle>(null);
  const coursesPanelRef = useRef<CoursesPanelHandle>(null);
  const documentTypesPanelRef = useRef<DocumentTypesPanelHandle>(null);

  /** Texto del botón de alta según tab (nombres del portal viejo). */
  const createLabel =
    tab === "ranks"
      ? "Nuevo rango"
      : tab === "degrees"
        ? "Nuevo título académico"
        : tab === "certificates"
          ? "Nuevo título marítimo"
          : tab === "courses"
            ? "Nuevo curso"
            : "Nuevo tipo de documento";

  /** Abre el modal del panel activo. */
  function openCreate() {
    if (tab === "ranks") ranksPanelRef.current?.openCreate();
    else if (tab === "degrees") degreesPanelRef.current?.openCreate();
    else if (tab === "certificates")
      certificatesPanelRef.current?.openCreate();
    else if (tab === "courses") coursesPanelRef.current?.openCreate();
    else documentTypesPanelRef.current?.openCreate();
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f9fafc]">
      <Topbar
        breadcrumb="Catálogos maestros"
        breadcrumbIcon={ClipboardList}
        actions={<UserMenu />}
      />

      <div className="animate-enter flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden pb-6 pl-8 pr-12 pt-7">
        <PageHeader
          crumbs={[
            { label: "Configuración" },
            { label: "Catálogos maestros" },
          ]}
          title="Catálogos maestros"
          description="Rangos, títulos, cursos y tipos de documento del expediente. Datos de referencia por empresa."
          actions={
            canCreate ? (
              <Button
                type="button"
                className="!w-auto shrink-0"
                onClick={openCreate}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                {createLabel}
              </Button>
            ) : undefined
          }
        />

        <div
          className="flex shrink-0 flex-wrap gap-1.5"
          role="tablist"
          aria-label="Secciones de catálogos"
        >
          {(
            [
              { id: "ranks" as const, label: "Rangos / cargos" },
              { id: "degrees" as const, label: "Títulos académicos" },
              { id: "certificates" as const, label: "Títulos marítimos" },
              { id: "courses" as const, label: "Cursos" },
              { id: "documentTypes" as const, label: "Tipos de documento" },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(t.id)}
                className={[
                  "inline-flex h-9 items-center rounded-[var(--radius-md)] px-3.5 text-[13px] font-medium",
                  active
                    ? "bg-[var(--color-nachipa-tab,#f4f4f5)] text-[var(--color-nachipa-title)]"
                    : "text-[var(--color-nachipa-secondary)] hover:bg-[var(--color-nachipa-bg-page)]",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "ranks" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
            <RanksPanel ref={ranksPanelRef} />
          </div>
        ) : null}

        {tab === "degrees" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
            <DegreesPanel ref={degreesPanelRef} />
          </div>
        ) : null}

        {tab === "certificates" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
            <CertificatesPanel ref={certificatesPanelRef} />
          </div>
        ) : null}

        {tab === "courses" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
            <CoursesPanel ref={coursesPanelRef} />
          </div>
        ) : null}

        {tab === "documentTypes" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
            <DocumentTypesPanel ref={documentTypesPanelRef} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
