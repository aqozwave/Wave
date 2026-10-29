import { useRef, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "../../components/Button/Button";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
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

/**
 * Pantalla Catálogos maestros.
 * Rangos, títulos, cursos y tipos de documento del expediente.
 */
export function Catalogos() {
  const { user } = useAuth();
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";
  const [tab, setTab] = useState<CatalogTab>("ranks");
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
            canManage ? (
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
                onClick={() => setTab(t.id)}
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
