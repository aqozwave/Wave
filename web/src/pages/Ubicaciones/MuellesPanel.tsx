import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Anchor, Download, MapPin, MoreVertical, Plus } from "lucide-react";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableOutlineButton,
  DataTableSearch,
  DataTableSelect,
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
  createMuelleRequest,
  deleteMuelleRequest,
  listMuellesRequest,
  updateMuelleRequest,
  type Muelle,
} from "../../lib/api/muelles";
import {
  createPortRequest,
  listPortsRequest,
  type Port,
} from "../../lib/api/ports";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { downloadCsv } from "../../lib/exportCsv";

/** API que el header usa para abrir el modal de alta. */
export type MuellesPanelHandle = {
  openCreate: () => void;
};

/** Form create / edit de muelle. */
type FormState = {
  name: string;
  portId: string;
  businessId: string;
  state: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  portId: "",
  businessId: "",
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
 * Panel Muelles dentro de Flota y operación.
 * Puerto desde catálogo; botón + abre modal rápido de nuevo puerto.
 */
export const MuellesPanel = forwardRef<MuellesPanelHandle>(function MuellesPanel(
  _props,
  ref,
) {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";

  const [items, setItems] = useState<Muelle[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Muelle | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  /** Dirección de orden por nombre; null = sin ordenar. */
  const [nameSort, setNameSort] = useState<"asc" | "desc" | null>(null);
  /** Filtro por puerto seleccionado en la toolbar; "all" = todos. */
  const [portFilter, setPortFilter] = useState("all");

  /** Modal anidado: alta rápida de puerto desde el form de muelle. */
  const [portModalOpen, setPortModalOpen] = useState(false);
  const [portNameDraft, setPortNameDraft] = useState("");
  const [portSubmitting, setPortSubmitting] = useState(false);

  const businessNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of businesses) {
      map.set(b.id, displayName(b.name));
    }
    return map;
  }, [businesses]);

  /**
   * Puertos del select: misma empresa del form (superadmin)
   * o todos los visibles (admin = su empresa).
   */
  const portsForForm = useMemo(() => {
    const active = ports.filter((p) => p.state);
    if (!isSuperadmin) return active;
    if (!form.businessId) return active;
    return active.filter((p) => p.businessId === form.businessId);
  }, [ports, isSuperadmin, form.businessId]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [muellesResult, portsResult, bizResult] = await Promise.all([
        listMuellesRequest(accessToken),
        listPortsRequest(accessToken),
        isSuperadmin
          ? listBusinessesRequest(accessToken)
          : Promise.resolve({ items: [] as Business[] }),
      ]);
      setItems(muellesResult.items);
      setPorts(portsResult.items);
      setBusinesses(bizResult.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los muelles.",
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
    let rows = items;
    // Filtro por puerto activo en la toolbar.
    if (portFilter !== "all") {
      rows = rows.filter((row) => row.portId === portFilter);
    }
    if (q) {
      rows = rows.filter((row) => {
        const biz = businessNameById.get(row.businessId) ?? "";
        return [row.name, row.portName, biz].join(" ").toLowerCase().includes(q);
      });
    }
    // Orden por nombre si está activo.
    if (nameSort) {
      rows = [...rows].sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, "es");
        return nameSort === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [items, search, businessNameById, portFilter, nameSort]);

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    pageItems,
    total,
  } = useClientTablePagination(filtered);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  useImperativeHandle(ref, () => ({ openCreate }), []);

  function openEdit(row: Muelle) {
    setEditing(row);
    setMenuId(null);
    setForm({
      name: row.name,
      portId: row.portId,
      businessId: row.businessId,
      state: row.state,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setPortModalOpen(false);
    setPortNameDraft("");
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Al cambiar empresa, limpia puerto si no pertenece a esa empresa.
      if (key === "businessId" && value) {
        const stillValid = ports.some(
          (p) => p.id === prev.portId && p.businessId === value,
        );
        if (!stillValid) next.portId = "";
      }
      return next;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    if (!form.name.trim()) {
      showToast("El nombre es requerido.", "danger");
      return;
    }
    if (!form.portId) {
      showToast("Elegí el puerto.", "danger");
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
        portId: string;
        state: boolean;
        businessId?: string;
      } = {
        name: form.name.trim(),
        portId: form.portId,
        state: form.state,
      };
      if (isSuperadmin && form.businessId) {
        body.businessId = form.businessId;
      }

      if (editing) {
        await updateMuelleRequest(accessToken, editing.id, body);
        showToast("Muelle actualizado.", "success");
      } else {
        await createMuelleRequest(accessToken, body);
        showToast("Muelle creado.", "success");
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

  async function onCreatePort(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    if (!portNameDraft.trim()) {
      showToast("El nombre del puerto es requerido.", "danger");
      return;
    }
    if (isSuperadmin && !form.businessId) {
      showToast("Elegí la empresa del muelle antes de crear el puerto.", "danger");
      return;
    }

    setPortSubmitting(true);
    try {
      const body: { name: string; businessId?: string } = {
        name: portNameDraft.trim(),
      };
      if (isSuperadmin && form.businessId) {
        body.businessId = form.businessId;
      }
      const created = await createPortRequest(accessToken, body);
      showToast("Puerto creado.", "success");
      setPorts((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
      setField("portId", created.id);
      setPortModalOpen(false);
      setPortNameDraft("");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo crear el puerto.",
        "danger",
      );
    } finally {
      setPortSubmitting(false);
    }
  }

  async function onDelete(row: Muelle) {
    if (!accessToken || !canManage) return;
    setMenuId(null);
    const ok = window.confirm(
      `¿Eliminar el muelle «${displayName(row.name)}»? Quedará desactivado.`,
    );
    if (!ok) return;
    try {
      await deleteMuelleRequest(accessToken, row.id);
      showToast("Muelle eliminado.", "success");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar.",
        "danger",
      );
    }
  }

  /** Descarga CSV de las filas filtradas (no solo la página actual). */
  function onExport() {
    if (filtered.length === 0) {
      showToast("No hay filas para exportar.", "info");
      return;
    }
    downloadCsv(
      filtered,
      [
        { header: "Nombre", value: (row) => displayName(row.name) },
        { header: "Puerto", value: (row) => row.portName || "" },
        // Columna empresa: solo disponible y relevante para superadmin.
        ...(isSuperadmin
          ? [
              {
                header: "Empresa",
                value: (row: Muelle) =>
                  businessNameById.get(row.businessId) ?? "",
              },
            ]
          : []),
        { header: "Estado", value: (row) => (row.state ? "Activo" : "Inactivo") },
      ],
      "muelles",
    );
    showToast("CSV descargado.", "success");
  }

  const selectClass =
    "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

  const colCount = isSuperadmin ? 5 : 4;

  return (
    <>
      <DataTableCard
        toolbar={
          <>
            {/* Búsqueda en la toolbar (patrón DataTable Figma). */}
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar muelle o puerto…"
            />
            {/* Filtro por puerto en la toolbar. */}
            <DataTableSelect
              value={portFilter}
              onChange={setPortFilter}
              aria-label="Filtrar por puerto"
              className="h-8 w-[180px] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2 text-[12px] text-[var(--color-nachipa-body)] outline-none"
            >
              <option value="all">Puerto: todos</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </DataTableSelect>
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
                : `${total} ${total === 1 ? "muelle" : "muelles"}`
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
            <col style={{ width: isSuperadmin ? "26%" : "32%" }} />
            <col style={{ width: isSuperadmin ? "22%" : "28%" }} />
            {isSuperadmin ? <col style={{ width: "22%" }} /> : null}
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr>
              {/* Encabezado Nombre: redondeado izquierdo, ordenable. */}
              <TableHeaderCell
                rounded="left"
                sortable
                sortDir={nameSort}
                onSort={() =>
                  setNameSort((d) =>
                    d === "asc" ? "desc" : d === "desc" ? null : "asc",
                  )
                }
              >
                Nombre
              </TableHeaderCell>
              <TableHeaderCell>Puerto</TableHeaderCell>
              {isSuperadmin ? (
                <TableHeaderCell>Empresa</TableHeaderCell>
              ) : null}
              <TableHeaderCell>Estado</TableHeaderCell>
              {/* Acciones: redondeado derecho, alineado a la derecha. */}
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
                  No hay muelles para mostrar.
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
                  {row.portName || "—"}
                </td>
                {isSuperadmin ? (
                  <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                    {businessNameById.get(row.businessId) ?? "—"}
                  </td>
                ) : null}
                <td className="h-[52px] px-3">
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
        icon={Anchor}
        title={editing ? "Editar muelle" : "Nuevo muelle"}
        subtitle="Muelle asociado a un puerto del catálogo."
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
              form="muelle-form"
              className="!w-auto !h-9"
              disabled={submitting}
            >
              {submitting
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Crear muelle"}
            </Button>
          </div>
        }
      >
        <form
          id="muelle-form"
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

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Puerto *
            </span>
            <div className="flex items-center gap-2">
              <select
                className={`${selectClass} min-w-0 flex-1`}
                value={form.portId}
                onChange={(e) => setField("portId", e.target.value)}
                required
              >
                <option value="">Seleccionar puerto</option>
                {portsForForm.map((port) => (
                  <option key={port.id} value={port.id}>
                    {port.name}
                  </option>
                ))}
              </select>
              {canManage ? (
                <button
                  type="button"
                  className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                  aria-label="Nuevo puerto"
                  title="Nuevo puerto"
                  onClick={() => {
                    setPortNameDraft("");
                    setPortModalOpen(true);
                  }}
                >
                  <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          <TextField
            label="Nombre *"
            name="name"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
            placeholder="Ej. Muelle norte"
          />

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
              aria-label="Muelle activo"
            />
          </div>
        </form>
      </Modal>

      {/* Alta rápida de puerto sin salir del modal de muelle. */}
      <Modal
        open={portModalOpen}
        icon={MapPin}
        title="Nuevo puerto"
        subtitle="Se asocia a la misma empresa del muelle."
        onClose={() => {
          setPortModalOpen(false);
          setPortNameDraft("");
        }}
        maxWidthClass="w-full max-w-[420px] sm:w-[420px]"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setPortModalOpen(false);
                setPortNameDraft("");
              }}
              disabled={portSubmitting}
              className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab,#f4f4f5)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="quick-port-form"
              className="!w-auto !h-9"
              disabled={portSubmitting}
            >
              {portSubmitting ? "Guardando…" : "Crear puerto"}
            </Button>
          </div>
        }
      >
        <form
          id="quick-port-form"
          onSubmit={onCreatePort}
          className="flex flex-col gap-4"
          noValidate
        >
          <TextField
            label="Nombre *"
            name="quickPortName"
            value={portNameDraft}
            onChange={(e) => setPortNameDraft(e.target.value)}
            required
            placeholder="Ej. Castro"
            autoFocus
          />
        </form>
      </Modal>
    </>
  );
});
