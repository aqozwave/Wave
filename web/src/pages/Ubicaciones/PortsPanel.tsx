import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Download, MapPin, MoreVertical } from "lucide-react";
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
  createPortRequest,
  deletePortRequest,
  listPortsRequest,
  updatePortRequest,
  type Port,
} from "../../lib/api/ports";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { downloadCsv } from "../../lib/exportCsv";

/** API que el header usa para abrir el modal de alta. */
export type PortsPanelHandle = {
  openCreate: () => void;
};

/** Form create / edit de puerto. */
type FormState = {
  name: string;
  businessId: string;
  state: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  businessId: "",
  state: true,
};

/** Capitaliza nombre para mostrar. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Panel Puertos dentro de Flota y operación.
 * Maestro por empresa; los muelles apuntan a un puerto.
 */
export const PortsPanel = forwardRef<PortsPanelHandle>(function PortsPanel(
  _props,
  ref,
) {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";

  const [items, setItems] = useState<Port[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Port | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  /** Dirección de orden por nombre; null = sin ordenar. */
  const [nameSort, setNameSort] = useState<"asc" | "desc" | null>(null);

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
      const [portsResult, bizResult] = await Promise.all([
        listPortsRequest(accessToken),
        isSuperadmin
          ? listBusinessesRequest(accessToken)
          : Promise.resolve({ items: [] as Business[] }),
      ]);
      setItems(portsResult.items);
      setBusinesses(bizResult.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los puertos.",
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
    if (q) {
      rows = rows.filter((row) => {
        const biz = businessNameById.get(row.businessId) ?? "";
        return [row.name, biz].join(" ").toLowerCase().includes(q);
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
  }, [items, search, businessNameById, nameSort]);

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

  function openEdit(row: Port) {
    setEditing(row);
    setMenuId(null);
    setForm({
      name: row.name,
      businessId: row.businessId,
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
      } = {
        name: form.name.trim(),
        state: form.state,
      };
      if (isSuperadmin && form.businessId) {
        body.businessId = form.businessId;
      }

      if (editing) {
        await updatePortRequest(accessToken, editing.id, body);
        showToast("Puerto actualizado.", "success");
      } else {
        await createPortRequest(accessToken, body);
        showToast("Puerto creado.", "success");
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

  async function onDelete(row: Port) {
    if (!accessToken || !canManage) return;
    setMenuId(null);
    const ok = window.confirm(
      `¿Eliminar el puerto «${row.name}»? Quedará desactivado.`,
    );
    if (!ok) return;
    try {
      await deletePortRequest(accessToken, row.id);
      showToast("Puerto eliminado.", "success");
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
        { header: "Nombre", value: (row) => row.name },
        // Columna empresa: solo disponible y relevante para superadmin.
        ...(isSuperadmin
          ? [
              {
                header: "Empresa",
                value: (row: Port) =>
                  businessNameById.get(row.businessId) ?? "",
              },
            ]
          : []),
        { header: "Estado", value: (row) => (row.state ? "Activo" : "Inactivo") },
      ],
      "puertos",
    );
    showToast("CSV descargado.", "success");
  }

  const selectClass =
    "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

  return (
    <>
      <DataTableCard
        toolbar={
          <>
            {/* Búsqueda en la toolbar (patrón DataTable Figma). */}
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar puerto…"
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
                : `${total} ${total === 1 ? "puerto" : "puertos"}`
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
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-[12px]">
          <colgroup>
            <col style={{ width: isSuperadmin ? "36%" : "48%" }} />
            {isSuperadmin ? <col style={{ width: "28%" }} /> : null}
            <col style={{ width: "16%" }} />
            <col style={{ width: "16%" }} />
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
                  colSpan={isSuperadmin ? 4 : 3}
                  className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                >
                  No hay puertos para mostrar.
                </td>
              </tr>
            ) : null}
            {pageItems.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--color-tremor-border)] last:border-b-0"
              >
                <td className="h-[52px] truncate px-3 font-medium text-[var(--color-nachipa-title)]">
                  {row.name}
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
        icon={MapPin}
        title={editing ? "Editar puerto" : "Nuevo puerto"}
        subtitle="Puerto del catálogo. Los muelles se asocian a un puerto."
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
              form="port-form"
              className="!w-auto !h-9"
              disabled={submitting}
            >
              {submitting
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Crear puerto"}
            </Button>
          </div>
        }
      >
        <form
          id="port-form"
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
            placeholder="Ej. Puerto Montt"
          />

          <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Activo
              </p>
              <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                Disponible para asociar muelles
              </p>
            </div>
            <Toggle
              checked={form.state}
              onChange={(next) => setField("state", next)}
              aria-label="Puerto activo"
            />
          </div>
        </form>
      </Modal>
    </>
  );
});
