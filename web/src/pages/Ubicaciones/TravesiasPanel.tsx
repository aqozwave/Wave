import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Download, MoreVertical, Route } from "lucide-react";
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
  createTravesiaRequest,
  deleteTravesiaRequest,
  listTravesiasRequest,
  updateTravesiaRequest,
  type Travesia,
} from "../../lib/api/travesias";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { downloadXls } from "../../lib/exportXls";

/** API que el header usa para abrir el modal de alta. */
export type TravesiasPanelHandle = {
  openCreate: () => void;
};

/** Cuotas de pasadas permitidas (misma regla que la API). */
const REQUIRED_PASSAGES_OPTIONS = [10, 4] as const;

/** Form create / edit de travesía. */
type FormState = {
  name: string;
  /** "" = sin elegir aún. */
  requiredPassages: "" | "10" | "4";
  businessId: string;
  state: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  requiredPassages: "",
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
 * Panel Travesías dentro de Flota y operación.
 * Catálogo por empresa con cuota de pasadas (10 o 4).
 */
export const TravesiasPanel = forwardRef<TravesiasPanelHandle>(
  function TravesiasPanel(_props, ref) {
    const { accessToken, user } = useAuth();
    const { showToast } = useToast();
    const isSuperadmin = user?.internalRol === "superadmin";
    const canManage =
      user?.internalRol === "admin" || user?.internalRol === "superadmin";

    const [items, setItems] = useState<Travesia[]>([]);
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Travesia | null>(null);
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
        const [travesiasResult, bizResult] = await Promise.all([
          listTravesiasRequest(accessToken),
          isSuperadmin
            ? listBusinessesRequest(accessToken)
            : Promise.resolve({ items: [] as Business[] }),
        ]);
        setItems(travesiasResult.items);
        setBusinesses(bizResult.items);
      } catch (err) {
        showToast(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar las travesías.",
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
          return [row.name, String(row.requiredPassages), biz]
            .join(" ")
            .toLowerCase()
            .includes(q);
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

    function openEdit(row: Travesia) {
      setEditing(row);
      setMenuId(null);
      const passages =
        row.requiredPassages === 10 || row.requiredPassages === 4
          ? (String(row.requiredPassages) as "10" | "4")
          : "";
      setForm({
        name: row.name,
        requiredPassages: passages,
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
      if (!form.requiredPassages) {
        showToast("Elegí la cuota de pasadas (10 o 4).", "danger");
        return;
      }
      if (!editing && isSuperadmin && !form.businessId) {
        showToast("Elegí la empresa.", "danger");
        return;
      }

      setSubmitting(true);
      try {
        const requiredPassages = Number(form.requiredPassages);
        const body: {
          name: string;
          requiredPassages: number;
          state: boolean;
          businessId?: string;
        } = {
          name: form.name.trim(),
          requiredPassages,
          state: form.state,
        };
        if (isSuperadmin && form.businessId) {
          body.businessId = form.businessId;
        }

        if (editing) {
          await updateTravesiaRequest(accessToken, editing.id, body);
          showToast("Travesía actualizada.", "success");
        } else {
          await createTravesiaRequest(accessToken, body);
          showToast("Travesía creada.", "success");
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

    async function onDelete(row: Travesia) {
      if (!accessToken || !canManage) return;
      setMenuId(null);
      const ok = window.confirm(
        `¿Eliminar la travesía «${displayName(row.name)}»? Quedará desactivada.`,
      );
      if (!ok) return;
      try {
        await deleteTravesiaRequest(accessToken, row.id);
        showToast("Travesía eliminada.", "success");
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
      downloadXls(
        filtered,
        [
          { header: "Nombre", value: (row) => displayName(row.name) },
          { header: "Pasadas", value: (row) => row.requiredPassages },
          // Columna empresa: solo disponible y relevante para superadmin.
          ...(isSuperadmin
            ? [
                {
                  header: "Empresa",
                  value: (row: Travesia) =>
                    businessNameById.get(row.businessId) ?? "",
                },
              ]
            : []),
          { header: "Estado", value: (row) => (row.state ? "Activo" : "Inactivo") },
        ],
        "travesias",
      );
      showToast("Excel descargado.", "success");
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
                placeholder="Buscar travesía…"
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
                  : `${total} ${total === 1 ? "travesía" : "travesías"}`
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
              <col style={{ width: isSuperadmin ? "18%" : "22%" }} />
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
                <TableHeaderCell>Pasadas</TableHeaderCell>
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
                    No hay travesías para mostrar.
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
                  <td className="h-[52px] truncate px-3 tabular-nums text-[var(--color-nachipa-body)]">
                    {row.requiredPassages}
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
          icon={Route}
          title={editing ? "Editar travesía" : "Nueva travesía"}
          subtitle="Catálogo por empresa. La cuota de pasadas es 10 o 4."
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
                form="travesia-form"
                className="!w-auto !h-9"
                disabled={submitting}
              >
                {submitting
                  ? "Guardando…"
                  : editing
                    ? "Guardar cambios"
                    : "Crear travesía"}
              </Button>
            </div>
          }
        >
          <form
            id="travesia-form"
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
              placeholder="Ej. Travesía norte"
            />

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Cuota de pasadas *
              </span>
              <select
                className={selectClass}
                value={form.requiredPassages}
                onChange={(e) =>
                  setField(
                    "requiredPassages",
                    e.target.value as FormState["requiredPassages"],
                  )
                }
                required
              >
                <option value="">Seleccionar…</option>
                {REQUIRED_PASSAGES_OPTIONS.map((n) => (
                  <option key={n} value={String(n)}>
                    {n} pasadas
                  </option>
                ))}
              </select>
            </label>

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
                aria-label="Travesía activa"
              />
            </div>
          </form>
        </Modal>
      </>
    );
  },
);
