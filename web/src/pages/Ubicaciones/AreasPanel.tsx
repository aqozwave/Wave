import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Download, Layers, MoreVertical } from "lucide-react";
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
  createAreaRequest,
  deleteAreaRequest,
  listAreasRequest,
  updateAreaRequest,
  type Area,
} from "../../lib/api/areas";
import { listLocationsRequest, type Location } from "../../lib/api/locations";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { downloadXls } from "../../lib/exportXls";

/** API que el header usa para abrir el modal de alta. */
export type AreasPanelHandle = {
  openCreate: () => void;
};

/** Form create / edit de área. */
type FormState = {
  name: string;
  locationId: string;
  state: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  locationId: "",
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
 * Panel Áreas dentro de Flota y operación.
 * Obliga elegir lugar de trabajo; businessId lo resuelve la API.
 * El alta se dispara desde el PageHeader vía ref.openCreate().
 */
export const AreasPanel = forwardRef<AreasPanelHandle>(function AreasPanel(
  _props,
  ref,
) {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";

  const [items, setItems] = useState<Area[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [nameSort, setNameSort] = useState<"asc" | "desc" | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const loc of locations) {
      map.set(loc.id, displayName(loc.name));
    }
    return map;
  }, [locations]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [areasResult, locsResult] = await Promise.all([
        listAreasRequest(accessToken),
        listLocationsRequest(accessToken),
      ]);
      setItems(areasResult.items);
      setLocations(locsResult.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las áreas.",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = items;
    if (locationFilter !== "all") {
      rows = rows.filter((row) => row.locationId === locationFilter);
    }
    if (q) {
      rows = rows.filter((row) => {
        const locName = locationNameById.get(row.locationId) ?? "";
        return [row.name, locName].join(" ").toLowerCase().includes(q);
      });
    }
    if (nameSort) {
      rows = [...rows].sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, "es");
        return nameSort === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [items, search, locationFilter, locationNameById, nameSort]);

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

  function openEdit(row: Area) {
    setEditing(row);
    setMenuId(null);
    setForm({
      name: row.name,
      locationId: row.locationId,
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
    if (!form.locationId) {
      showToast("Elegí el lugar de trabajo.", "danger");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        locationId: form.locationId,
        state: form.state,
      };
      if (editing) {
        await updateAreaRequest(accessToken, editing.id, body);
        showToast("Área actualizada.", "success");
      } else {
        await createAreaRequest(accessToken, body);
        showToast("Área creada.", "success");
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

  async function onDelete(row: Area) {
    if (!accessToken || !canManage) return;
    setMenuId(null);
    const ok = window.confirm(
      `¿Eliminar el área «${displayName(row.name)}»? Quedará desactivada.`,
    );
    if (!ok) return;
    try {
      await deleteAreaRequest(accessToken, row.id);
      showToast("Área eliminada.", "success");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar.",
        "danger",
      );
    }
  }

  /** Descarga CSV de las filas filtradas (no solo la página). */
  function onExport() {
    if (filtered.length === 0) {
      showToast("No hay filas para exportar.", "info");
      return;
    }
    downloadXls(
      filtered,
      [
        { header: "Nombre", value: (row) => displayName(row.name) },
        {
          header: "Lugar de trabajo",
          value: (row) => locationNameById.get(row.locationId) ?? "",
        },
        {
          header: "Estado",
          value: (row) => (row.state ? "Activo" : "Inactivo"),
        },
      ],
      "areas",
    );
    showToast("Excel descargado.", "success");
  }

  const selectClass =
    "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

  return (
    <>
      <DataTableCard
        toolbar={
          <>
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar área…"
            />
            <DataTableSelect
              value={locationFilter}
              onChange={setLocationFilter}
              aria-label="Filtrar por lugar"
              className="h-8 w-[200px] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2 text-[12px] text-[var(--color-nachipa-body)] outline-none"
            >
              <option value="all">Lugar: todos</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {displayName(loc.name)}
                </option>
              ))}
            </DataTableSelect>
            <DataTableOutlineButton
              onClick={onExport}
              disabled={loading || filtered.length === 0}
            >
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
                : `${total} ${total === 1 ? "área" : "áreas"}`
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
            <col style={{ width: "32%" }} />
            <col style={{ width: "36%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "16%" }} />
          </colgroup>
          <thead>
            <tr>
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
              <TableHeaderCell>Lugar de trabajo</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell rounded="right" align="right">
                Acciones
              </TableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {!loading && total === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                >
                  No hay áreas para mostrar.
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
                  {locationNameById.get(row.locationId) ?? "—"}
                </td>
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
        icon={Layers}
        title={editing ? "Editar área" : "Nueva área"}
        subtitle="El área pertenece a un lugar de trabajo de la empresa."
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
              form="area-form"
              className="!w-auto !h-9"
              disabled={submitting}
            >
              {submitting
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Crear área"}
            </Button>
          </div>
        }
      >
        <form
          id="area-form"
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Lugar de trabajo *
            </span>
            <select
              className={selectClass}
              value={form.locationId}
              onChange={(e) => setField("locationId", e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {displayName(loc.name)}
                </option>
              ))}
            </select>
          </label>

          <TextField
            label="Nombre *"
            name="name"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
            placeholder="Ej. Cubierta"
          />

          <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Activo
              </p>
              <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                Disponible para asignar a usuarios
              </p>
            </div>
            <Toggle
              checked={form.state}
              onChange={(next) => setField("state", next)}
              aria-label="Área activa"
            />
          </div>
        </form>
      </Modal>
    </>
  );
});
