import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { BookOpen, Download, MoreVertical } from "lucide-react";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableOutlineButton,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
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
import {
  listBusinessesRequest,
  type Business,
} from "../../lib/api/businesses";
import {
  createCourseRequest,
  deleteCourseRequest,
  listCoursesRequest,
  updateCourseRequest,
  type Course,
} from "../../lib/api/courses";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { downloadXls } from "../../lib/exportXls";

/** API que el header usa para abrir el modal de alta. */
export type CoursesPanelHandle = {
  openCreate: () => void;
};

/** Form create / edit de curso. */
type FormState = {
  name: string;
  whereTaught: string;
  businessId: string;
  description: string;
  isMandatory: boolean;
  state: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  whereTaught: "",
  businessId: "",
  description: "",
  isMandatory: true,
  state: true,
};

/** Capitaliza nombre en minúsculas. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Panel Cursos dentro de Catálogos maestros.
 * Nombre + lugar de dictado; opcional descripción y obligatorio.
 */
export const CoursesPanel = forwardRef<CoursesPanelHandle>(function CoursesPanel(
  _props,
  ref,
) {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";

  const [items, setItems] = useState<Course[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

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
      const [coursesResult, bizResult] = await Promise.all([
        listCoursesRequest(accessToken),
        isSuperadmin
          ? listBusinessesRequest(accessToken)
          : Promise.resolve({ items: [] as Business[] }),
      ]);
      setItems(coursesResult.items);
      setBusinesses(bizResult.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los cursos.",
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
      return [row.name, row.whereTaught, row.description ?? "", biz]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, search, businessNameById]);

  // Paginación cliente sobre la lista filtrada
  const { page, setPage, pageSize, setPageSize, pageCount, pageItems, total } =
    useClientTablePagination(filtered);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  useImperativeHandle(ref, () => ({ openCreate }), []);

  function openEdit(row: Course) {
    setEditing(row);
    setMenuId(null);
    setForm({
      name: row.name,
      whereTaught: row.whereTaught,
      businessId: row.businessId,
      description: row.description ?? "",
      isMandatory: row.isMandatory,
      state: row.state,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    if (!form.name.trim()) {
      showToast("El nombre es requerido.", "danger");
      return;
    }
    if (!form.whereTaught.trim()) {
      showToast("El lugar de dictado es requerido.", "danger");
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
        whereTaught: string;
        description: string | null;
        isMandatory: boolean;
        state: boolean;
        businessId?: string;
      } = {
        name: form.name.trim(),
        whereTaught: form.whereTaught.trim(),
        description: form.description.trim() || null,
        isMandatory: form.isMandatory,
        state: form.state,
      };
      if (isSuperadmin && form.businessId) {
        body.businessId = form.businessId;
      }

      if (editing) {
        await updateCourseRequest(accessToken, editing.id, body);
        showToast("Curso actualizado.", "success");
      } else {
        await createCourseRequest(accessToken, body);
        showToast("Curso creado.", "success");
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

  async function onDelete(row: Course) {
    if (!accessToken || !canManage) return;
    setMenuId(null);
    const ok = window.confirm(
      `¿Eliminar el curso «${displayName(row.name)}»? Quedará desactivado.`,
    );
    if (!ok) return;
    try {
      await deleteCourseRequest(accessToken, row.id);
      showToast("Curso eliminado.", "success");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar.",
        "danger",
      );
    }
  }

  /** Descarga CSV de los cursos filtrados (no solo la página actual). */
  function onExport() {
    if (filtered.length === 0) {
      showToast("No hay filas para exportar.", "info");
      return;
    }
    downloadXls(
      filtered,
      [
        { header: "Nombre", value: (row) => displayName(row.name) },
        { header: "Lugar de dictado", value: (row) => displayName(row.whereTaught) },
        // Columna empresa: solo disponible y relevante para superadmin.
        ...(isSuperadmin
          ? [
              {
                header: "Empresa",
                value: (row: Course) =>
                  businessNameById.get(row.businessId) ?? "",
              },
            ]
          : []),
        { header: "Obligatorio", value: (row) => (row.isMandatory ? "Sí" : "No") },
        { header: "Estado", value: (row) => (row.state ? "Activo" : "Inactivo") },
      ],
      "cursos",
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
            {/* Búsqueda por nombre, lugar de dictado o empresa */}
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar curso…"
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
                : `${total} ${total === 1 ? "curso" : "cursos"}`
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
        <table className="w-full min-w-[800px] table-fixed border-collapse text-left text-[12px]">
          <colgroup>
            <col style={{ width: isSuperadmin ? "22%" : "26%" }} />
            <col style={{ width: isSuperadmin ? "20%" : "24%" }} />
            {isSuperadmin ? <col style={{ width: "18%" }} /> : null}
            <col style={{ width: "14%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr>
              {/* Primera columna: esquina izquierda redondeada */}
              <TableHeaderCell rounded="left">Nombre</TableHeaderCell>
              <TableHeaderCell>Lugar de dictado</TableHeaderCell>
              {isSuperadmin ? (
                <TableHeaderCell>Empresa</TableHeaderCell>
              ) : null}
              <TableHeaderCell>Obligatorio</TableHeaderCell>
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
                  No hay cursos para mostrar.
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
                <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                  {displayName(row.whereTaught)}
                </td>
                {isSuperadmin ? (
                  <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                    {businessNameById.get(row.businessId) ?? "—"}
                  </td>
                ) : null}
                <td className="h-[52px] px-3 text-[var(--color-nachipa-body)]">
                  {/* Obligatorio como texto: "Sí" / "No" — no necesita chip */}
                  {row.isMandatory ? "Sí" : "No"}
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
                          setMenuId((id) => (id === row.id ? null : row.id))
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
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                            onClick={() => openEdit(row)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-status-danger-fg)] hover:bg-[var(--color-status-danger-bg)]"
                            onClick={() => void onDelete(row)}
                          >
                            Eliminar
                          </button>
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
        icon={BookOpen}
        title={editing ? "Editar curso" : "Nuevo curso"}
        subtitle="Curso del catálogo de formación, asociado a una empresa."
        onClose={closeModal}
        maxWidthClass="w-full max-w-[520px] sm:w-[520px]"
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
              form="course-form"
              className="!w-auto !h-9"
              disabled={submitting}
            >
              {submitting
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Crear curso"}
            </Button>
          </div>
        }
      >
        <form
          id="course-form"
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
            placeholder="Ej. STCW básico"
          />

          <TextField
            label="Lugar de dictado *"
            name="whereTaught"
            value={form.whereTaught}
            onChange={(e) => setField("whereTaught", e.target.value)}
            required
            placeholder="Ej. Armada de Chile"
          />

          <TextField
            label="Descripción"
            name="description"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Opcional"
          />

          <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Obligatorio
              </p>
              <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                Requerido para el cumplimiento del tripulante
              </p>
            </div>
            <Toggle
              checked={form.isMandatory}
              onChange={(next) => setField("isMandatory", next)}
              aria-label="Curso obligatorio"
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
              aria-label="Curso activo"
            />
          </div>
        </form>
      </Modal>
    </>
  );
});
