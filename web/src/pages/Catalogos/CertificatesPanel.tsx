import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Award, Download, MoreVertical } from "lucide-react";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableOutlineButton,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { ConfirmModal } from "../../components/ConfirmModal/ConfirmModal";
import { Modal } from "../../components/Modal/Modal";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TableHeaderCell } from "../../components/TableHeaderCell/TableHeaderCell";
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { useToast } from "../../components/Toast/ToastProvider";
import { userHasPermission } from "../../lib/api/auth";
import {
  listBusinessesRequest,
  type Business,
} from "../../lib/api/businesses";
import {
  createCompetencyCertificateRequest,
  deleteCompetencyCertificateRequest,
  listCompetencyCertificateCoursesRequest,
  listCompetencyCertificatesRequest,
  replaceCompetencyCertificateCoursesRequest,
  updateCompetencyCertificateRequest,
  type CertificateCourseAssignment,
  type CompetencyCertificate,
  type OfficerKind,
} from "../../lib/api/competencyCertificates";
import { listCoursesRequest, type Course } from "../../lib/api/courses";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { downloadXls } from "../../lib/exportXls";

/** API que el header usa para abrir el modal de alta. */
export type CertificatesPanelHandle = {
  openCreate: () => void;
};

/** Opciones de oficial de nave (portal viejo). */
const OFFICER_KIND_OPTIONS: ReadonlyArray<{
  value: "" | OfficerKind;
  label: string;
}> = [
  { value: "", label: "No aplica" },
  { value: "captain", label: "Capitán" },
  { value: "first_pilot", label: "Primer piloto" },
];

/** Form create / edit de título marítimo. */
type FormState = {
  name: string;
  businessId: string;
  /** "" = null en API. */
  officerKind: "" | OfficerKind;
  /** Exige asignar muelles y travesías al tripulante. */
  requiresMuelleTravesia: boolean;
  state: boolean;
  /** Cursos del título (editor N:M). */
  courseAssignments: CertificateCourseAssignment[];
};

const EMPTY_FORM: FormState = {
  name: "",
  businessId: "",
  officerKind: "",
  requiresMuelleTravesia: false,
  state: true,
  courseAssignments: [],
};

/** Capitaliza nombre en minúsculas. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Etiqueta legible de officerKind. */
function officerKindLabel(value: OfficerKind | null): string {
  if (value === "captain") return "Capitán";
  if (value === "first_pilot") return "Primer piloto";
  return "—";
}

/**
 * Panel Títulos marítimos dentro de Catálogos maestros.
 * Incluye oficial de nave + cursos vinculados al título (S8).
 */
export const CertificatesPanel = forwardRef<CertificatesPanelHandle>(
  function CertificatesPanel(_props, ref) {
    const { accessToken, user } = useAuth();
    const { showToast } = useToast();
    const isSuperadmin = user?.internalRol === "superadmin";
    /** Alta de título marítimo según RBAC. */
    const canCreate = userHasPermission(user, "maestros.certificates", "create");
    /** Editar título marítimo según RBAC. */
    const canUpdate = userHasPermission(user, "maestros.certificates", "update");
    /** Desactivar / eliminar título marítimo según RBAC. */
    const canDeactivate = userHasPermission(user, "maestros.certificates", "deactivate");
    /** Alta / editar / desactivar según RBAC (no internalRol). */
    const canManage = canCreate || canUpdate || canDeactivate;

    const [items, setItems] = useState<CompetencyCertificate[]>([]);
    const [businesses, setBusinesses] = useState<Business[]>([]);
    /** Catálogo de cursos de la empresa del form (para el checklist). */
    const [courseCatalog, setCourseCatalog] = useState<Course[]>([]);
    const [coursesLoading, setCoursesLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<CompetencyCertificate | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [menuId, setMenuId] = useState<string | null>(null);
    /** Fila pendiente de confirmar eliminación (modal del sistema). */
    const [pendingDelete, setPendingDelete] =
      useState<CompetencyCertificate | null>(null);
    const [deleting, setDeleting] = useState(false);

    const businessNameById = useMemo(() => {
      const map = new Map<string, string>();
      for (const b of businesses) {
        map.set(b.id, displayName(b.name));
      }
      return map;
    }, [businesses]);

    const load = useCallback(async () => {
      if (!accessToken) return;
      setLoading(true);
      try {
        const [certsResult, bizResult] = await Promise.all([
          listCompetencyCertificatesRequest(accessToken),
          isSuperadmin
            ? listBusinessesRequest(accessToken)
            : Promise.resolve({ items: [] as Business[] }),
        ]);
        setItems(certsResult.items);
        setBusinesses(bizResult.items);
      } catch (err) {
        showToast(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los títulos marítimos.",
          "danger",
        );
      } finally {
        setLoading(false);
      }
    }, [accessToken, isSuperadmin, showToast]);

    useEffect(() => {
      void load();
    }, [load]);

    const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return items;
      return items.filter((row) => {
        const biz = businessNameById.get(row.businessId) ?? "";
        const kind = officerKindLabel(row.officerKind);
        return [row.name, biz, kind].join(" ").toLowerCase().includes(q);
      });
    }, [items, search, businessNameById]);

    // Paginación cliente sobre la lista filtrada
    const { page, setPage, pageSize, setPageSize, pageCount, pageItems, total } =
      useClientTablePagination(filtered);

    /** Empresa efectiva del form (admin = la suya). */
    const formBusinessId = useMemo(() => {
      if (isSuperadmin) return form.businessId;
      return form.businessId || user?.businessId || "";
    }, [form.businessId, isSuperadmin, user?.businessId]);

    /** Carga catálogo de cursos de la empresa del título. */
    const loadCourseCatalog = useCallback(
      async (businessId: string) => {
        if (!accessToken || !businessId) {
          setCourseCatalog([]);
          return;
        }
        setCoursesLoading(true);
        try {
          const res = await listCoursesRequest(accessToken, 1, 100, {
            businessId,
          });
          setCourseCatalog(
            res.items.filter((c) => c.state && c.businessId === businessId),
          );
        } catch {
          setCourseCatalog([]);
        } finally {
          setCoursesLoading(false);
        }
      },
      [accessToken],
    );

    function openCreate() {
      setEditing(null);
      const initialBiz = isSuperadmin ? "" : user?.businessId || "";
      setForm({ ...EMPTY_FORM, businessId: initialBiz });
      setCourseCatalog([]);
      setModalOpen(true);
      if (initialBiz) void loadCourseCatalog(initialBiz);
    }

    useImperativeHandle(ref, () => ({ openCreate }), [
      isSuperadmin,
      loadCourseCatalog,
      user?.businessId,
    ]);

    async function openEdit(row: CompetencyCertificate) {
      setEditing(row);
      setMenuId(null);
      setForm({
        name: row.name,
        businessId: row.businessId,
        officerKind: row.officerKind ?? "",
        requiresMuelleTravesia: row.requiresMuelleTravesia,
        state: row.state,
        courseAssignments: [],
      });
      setModalOpen(true);
      void loadCourseCatalog(row.businessId);
      if (!accessToken) return;
      try {
        const linked = await listCompetencyCertificateCoursesRequest(
          accessToken,
          row.id,
        );
        setForm((prev) => ({
          ...prev,
          courseAssignments: linked.assignments.map((a) => ({
            courseId: a.courseId,
            isMandatory: a.isMandatory !== false,
          })),
        }));
      } catch (err) {
        showToast(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los cursos del título.",
          "danger",
        );
      }
    }

    function closeModal() {
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setCourseCatalog([]);
    }

    function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        // Al cambiar empresa (alta superadmin), limpia cursos elegidos.
        if (key === "businessId") {
          next.courseAssignments = [];
        }
        return next;
      });
      if (key === "businessId" && typeof value === "string" && value) {
        void loadCourseCatalog(value);
      }
    }

    /** Marca / desmarca un curso del título. */
    function toggleCourse(courseId: string) {
      setForm((prev) => {
        const exists = prev.courseAssignments.some(
          (a) => a.courseId === courseId,
        );
        if (exists) {
          return {
            ...prev,
            courseAssignments: prev.courseAssignments.filter(
              (a) => a.courseId !== courseId,
            ),
          };
        }
        return {
          ...prev,
          courseAssignments: [
            ...prev.courseAssignments,
            { courseId, isMandatory: true },
          ],
        };
      });
    }

    /** Cambia el flag obligatorio de un curso ya seleccionado. */
    function setCourseMandatory(courseId: string, isMandatory: boolean) {
      setForm((prev) => ({
        ...prev,
        courseAssignments: prev.courseAssignments.map((a) =>
          a.courseId === courseId ? { ...a, isMandatory } : a,
        ),
      }));
    }

    async function onSubmit(event: FormEvent) {
      event.preventDefault();
      if (!accessToken || !(editing ? canUpdate : canCreate)) return;
      if (!form.name.trim()) {
        showToast("El nombre es requerido.", "danger");
        return;
      }
      if (!editing && isSuperadmin && !form.businessId) {
        showToast("Elegí la empresa.", "danger");
        return;
      }

      setSubmitting(true);
      try {
        const body: {
          name: string;
          state: boolean;
          businessId?: string;
          officerKind: OfficerKind | null;
          requiresMuelleTravesia: boolean;
        } = {
          name: form.name.trim(),
          state: form.state,
          officerKind: form.officerKind === "" ? null : form.officerKind,
          requiresMuelleTravesia: form.requiresMuelleTravesia,
        };
        if (isSuperadmin && form.businessId) {
          body.businessId = form.businessId;
        }

        let certificateId = editing?.id ?? null;
        if (editing) {
          await updateCompetencyCertificateRequest(
            accessToken,
            editing.id,
            body,
          );
        } else {
          const created = await createCompetencyCertificateRequest(
            accessToken,
            body,
          );
          certificateId = created.id;
        }

        // Siempre reemplaza el set (también vacío = quitar todos).
        if (certificateId) {
          const syncResult = await replaceCompetencyCertificateCoursesRequest(
            accessToken,
            certificateId,
            { assignments: form.courseAssignments },
          );
          const created = syncResult.sync.assignmentsCreated;
          if (created > 0) {
            showToast(
              editing
                ? `Título actualizado. ${created} curso(s) agregados a embarcados.`
                : `Título creado. ${created} curso(s) agregados a embarcados.`,
              "success",
            );
          } else {
            showToast(
              editing
                ? "Título marítimo actualizado."
                : "Título marítimo creado.",
              "success",
            );
          }
        }

        closeModal();
        await load();
      } catch (err) {
        showToast(
          err instanceof ApiError ? err.message : "No se pudo guardar.",
          "danger",
        );
      } finally {
        setSubmitting(false);
      }
    }

    function requestDelete(row: CompetencyCertificate) {
      if (!canDeactivate) return;
      setMenuId(null);
      setPendingDelete(row);
    }

    /** Soft-delete confirmado vía modal del sistema. */
    async function confirmDelete() {
      if (!accessToken || !canDeactivate || !pendingDelete) return;
      setDeleting(true);
      try {
        await deleteCompetencyCertificateRequest(
          accessToken,
          pendingDelete.id,
        );
        showToast("Título marítimo eliminado.", "success");
        setPendingDelete(null);
        await load();
      } catch (err) {
        showToast(
          err instanceof ApiError ? err.message : "No se pudo eliminar.",
          "danger",
        );
      } finally {
        setDeleting(false);
      }
    }

    /** Descarga CSV de los títulos marítimos filtrados (no solo la página actual). */
    function onExport() {
      if (filtered.length === 0) {
        showToast("No hay filas para exportar.", "info");
        return;
      }
      downloadXls(
        filtered,
        [
          { header: "Nombre", value: (row) => displayName(row.name) },
          // Columna empresa: solo disponible y relevante para superadmin.
          ...(isSuperadmin
            ? [
                {
                  header: "Empresa",
                  value: (row: CompetencyCertificate) =>
                    businessNameById.get(row.businessId) ?? "",
                },
              ]
            : []),
          {
            header: "Oficial de nave",
            value: (row) => officerKindLabel(row.officerKind),
          },
          {
            header: "Muelles / travesías",
            value: (row) => (row.requiresMuelleTravesia ? "Exigido" : "No"),
          },
          { header: "Estado", value: (row) => (row.state ? "Activo" : "Inactivo") },
        ],
        "titulos-maritimos",
      );
      showToast("Excel descargado.", "success");
    }

    const selectClass =
      "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

    // Número de columnas para el mensaje vacío (varía con superadmin)
    const colCount = isSuperadmin ? 6 : 5;

    return (
      <>
        {/* DataTableCard: toolbar con búsqueda y exportar, tabla, pie con paginación */}
        <DataTableCard
          toolbar={
            <>
              {/* Búsqueda por nombre, empresa u oficial */}
              <DataTableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar título marítimo…"
              />
              <DataTableOutlineButton onClick={onExport}>
                <Download className="size-3.5" strokeWidth={1.5} aria-hidden />
                Exportar
              </DataTableOutlineButton>
            </>
          }
          footer={
            <TablePagination
              totalLabel={
                loading
                  ? "Cargando…"
                  : `${total} ${total === 1 ? "título marítimo" : "títulos marítimos"}`
              }
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              hidePageSize
            />
          }
        >
          <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-[12px]">
            <colgroup>
              <col style={{ width: isSuperadmin ? "28%" : "36%" }} />
              {isSuperadmin ? <col style={{ width: "22%" }} /> : null}
              <col style={{ width: "18%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr>
                {/* Primera columna: esquina izquierda redondeada */}
                <TableHeaderCell rounded="left">Nombre</TableHeaderCell>
                {isSuperadmin ? (
                  <TableHeaderCell>Empresa</TableHeaderCell>
                ) : null}
                <TableHeaderCell>Oficial de nave</TableHeaderCell>
                <TableHeaderCell>Muelles / travesías</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                {/* Última columna: esquina derecha redondeada, acciones a la derecha */}
                <TableHeaderCell rounded="right" align="right">
                  Acciones
                </TableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {!loading && total === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                  >
                    No hay títulos marítimos para mostrar.
                  </td>
                </tr>
              ) : null}
              {pageItems.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--color-tremor-border)] last:border-b-0"
                >
                  <td className="h-[52px] truncate px-3 font-medium text-[var(--color-nachipa-title)]">
                    {displayName(row.name)}
                  </td>
                  {isSuperadmin ? (
                    <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {businessNameById.get(row.businessId) ?? "—"}
                    </td>
                  ) : null}
                  <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                    {officerKindLabel(row.officerKind)}
                  </td>
                  <td className="h-[52px] px-3">
                    {/* Chip info: exige muelles/travesías; neutral: no exige */}
                    <StatusChip
                      tone={row.requiresMuelleTravesia ? "info" : "neutral"}
                    >
                      {row.requiresMuelleTravesia ? "Exigido" : "No"}
                    </StatusChip>
                  </td>
                  <td className="h-[52px] px-3">
                    {/* Chip de estado: verde activo / rojo inactivo */}
                    <StatusChip tone={row.state ? "success" : "danger"}>
                      {row.state ? "Activo" : "Inactivo"}
                    </StatusChip>
                  </td>
                  <td className="relative h-[52px] px-3 text-right">
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-icon-default)] hover:bg-[var(--color-nachipa-bg-page)]"
                          aria-label="Acciones"
                          onClick={() =>
                            setMenuId((id) =>
                              id === row.id ? null : row.id,
                            )
                          }
                        >
                          <MoreVertical
                            className="size-[18px]"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </button>
                        {menuId === row.id ? (
                          <div className="absolute right-3 top-11 z-10 min-w-[140px] rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white py-1 shadow-lg">
                            {canUpdate ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                                onClick={() => openEdit(row)}
                              >
                                Editar
                              </button>
                            ) : null}
                            {canDeactivate ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-status-danger-fg)] hover:bg-[var(--color-status-danger-bg)]"
                                onClick={() => requestDelete(row)}
                              >
                                Eliminar
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-[var(--color-nachipa-secondary)]">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableCard>

        <Modal
          open={modalOpen}
          icon={Award}
          title={editing ? "Editar título marítimo" : "Nuevo título marítimo"}
          subtitle="Muelles/travesías y cursos del título. Al guardar, se syncan altas a embarcados con este título."
          onClose={closeModal}
          maxWidthClass="w-full max-w-[640px] sm:w-[640px]"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab,#f4f4f5)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
              >
                Cancelar
              </button>
              <Button
                type="submit"
                form="certificate-form"
                className="!w-auto !h-9"
                disabled={submitting}
              >
                {submitting
                  ? "Guardando…"
                  : editing
                    ? "Guardar cambios"
                    : "Crear título marítimo"}
              </Button>
            </div>
          }
        >
          <form
            id="certificate-form"
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
            noValidate
          >
            {isSuperadmin ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Empresa *
                </span>
                <select
                  className={selectClass}
                  value={form.businessId}
                  onChange={(e) => setField("businessId", e.target.value)}
                  required
                  disabled={Boolean(editing)}
                >
                  <option value="">Seleccionar…</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {displayName(b.name)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <TextField
              label="Nombre *"
              name="name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              required
              placeholder="Ej. Jefe de máquina, Oficial de guardia…"
            />

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Oficial de nave
              </span>
              <select
                className={selectClass}
                value={form.officerKind}
                onChange={(e) =>
                  setField(
                    "officerKind",
                    e.target.value as "" | OfficerKind,
                  )
                }
              >
                {OFFICER_KIND_OPTIONS.map((opt) => (
                  <option key={opt.value || "none"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                Solo etiqueta. No define muelles ni travesías.
              </span>
            </label>

            <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Exige muelles y travesías
                </p>
                <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                  En el modal del embarcado pide al menos 1 muelle y 1 travesía
                </p>
              </div>
              <Toggle
                checked={form.requiresMuelleTravesia}
                onChange={(next) => setField("requiresMuelleTravesia", next)}
                aria-label="Exige muelles y travesías"
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Activo
                </p>
                <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                  Disponible para asignar a tripulantes
                </p>
              </div>
              <Toggle
                checked={form.state}
                onChange={(next) => setField("state", next)}
                aria-label="Título marítimo activo"
              />
            </div>

            {/* Cursos del título: checklist + obligatorio. */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-tremor-border)]">
              <div className="border-b border-[var(--color-tremor-border)] px-3.5 py-3">
                <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Cursos del título
                </p>
                <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                  Se asignan solos al embarcado cuando tiene este título
                  {form.courseAssignments.length > 0
                    ? ` · ${form.courseAssignments.length} seleccionados`
                    : ""}
                </p>
              </div>
              <div className="max-h-56 overflow-y-auto px-2 py-2">
                {!formBusinessId ? (
                  <p className="px-2 py-4 text-center text-[12px] text-[var(--color-nachipa-secondary)]">
                    Elegí la empresa para listar cursos.
                  </p>
                ) : coursesLoading ? (
                  <p className="px-2 py-4 text-center text-[12px] text-[var(--color-nachipa-secondary)]">
                    Cargando cursos…
                  </p>
                ) : courseCatalog.length === 0 ? (
                  <p className="px-2 py-4 text-center text-[12px] text-[var(--color-nachipa-secondary)]">
                    No hay cursos activos en esta empresa.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {courseCatalog.map((course) => {
                      const selected = form.courseAssignments.find(
                        (a) => a.courseId === course.id,
                      );
                      return (
                        <li
                          key={course.id}
                          className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--color-nachipa-bg-page,#f9fafc)]"
                        >
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[13px] text-[var(--color-nachipa-title)]">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-[var(--color-tremor-border)]"
                              checked={Boolean(selected)}
                              onChange={() => toggleCourse(course.id)}
                            />
                            <span className="min-w-0 truncate">
                              {displayName(course.name)}
                              <span className="text-[var(--color-nachipa-secondary)]">
                                {" "}
                                · {displayName(course.whereTaught)}
                              </span>
                            </span>
                          </label>
                          {selected ? (
                            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] text-[var(--color-nachipa-secondary)]">
                              <input
                                type="checkbox"
                                className="size-3.5 rounded border-[var(--color-tremor-border)]"
                                checked={selected.isMandatory}
                                onChange={(e) =>
                                  setCourseMandatory(
                                    course.id,
                                    e.target.checked,
                                  )
                                }
                              />
                              Obligatorio
                            </label>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </form>
        </Modal>

        <ConfirmModal
          open={pendingDelete !== null}
          title="Eliminar título marítimo"
          message={
            pendingDelete
              ? `¿Eliminar el título marítimo «${displayName(pendingDelete.name)}»?`
              : "¿Eliminar este título marítimo?"
          }
          detail="Quedará desactivado."
          confirmLabel="Eliminar"
          busyLabel="Eliminando…"
          busy={deleting}
          onClose={() => {
            if (!deleting) setPendingDelete(null);
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      </>
    );
  },
);
