import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { GraduationCap, MoreVertical, Plus } from "lucide-react";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  listBusinessesRequest,
  type Business,
} from "../../lib/api/businesses";
import {
  listDocumentTypesRequest,
  type DocumentType,
} from "../../lib/api/documentTypes";
import {
  createTrainingRequest,
  deleteTrainingRequest,
  listTrainingsRequest,
  updateTrainingRequest,
  type Training,
  type TrainingAppliesTo,
} from "../../lib/api/trainings";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Etiqueta de appliesTo. */
function appliesToLabel(tags: Training["appliesTo"]): string {
  if (tags.length === 0) return "—";
  return tags
    .map((t) => (t === "crew" ? "Tripulación" : "Externo"))
    .join(", ");
}

/** Form create / edit. */
type FormState = {
  code: string;
  name: string;
  validityMonths: string;
  appliesCrew: boolean;
  appliesExternal: boolean;
  documentTypeId: string;
  businessId: string;
  active: boolean;
};

/** Form vacío. */
const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  validityMonths: "",
  appliesCrew: true,
  appliesExternal: false,
  documentTypeId: "",
  businessId: "",
  active: true,
};

/** Clase de selects del modal. */
const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

/**
 * Listado de capacitaciones Prevención (P1 / P4) con CRUD.
 * Mutaciones: admin/superadmin (requireTenantManager en API).
 */
export function TrainingsPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";

  const [items, setItems] = useState<Training[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Training | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<Training | null>(
    null,
  );
  const [deactivating, setDeactivating] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await listTrainingsRequest(accessToken, 1, 100);
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar capacitaciones",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!accessToken) return;
    // Nombres para la columna Empresa (superadmin ve varios tenants).
    void listBusinessesRequest(accessToken)
      .then((res) => setBusinesses(res.items))
      .catch(() => setBusinesses([]));
  }, [accessToken]);

  /** businessId → nombre para la tabla. */
  const businessNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of businesses) map.set(b.id, b.name);
    return map;
  }, [businesses]);

  /** Carga tipos de documento de la empresa del form (o la del admin). */
  const loadDocumentTypes = useCallback(
    async (businessId: string | undefined) => {
      if (!accessToken) return;
      try {
        const res = await listDocumentTypesRequest(accessToken, 1, 100, {
          businessId: businessId || undefined,
        });
        setDocumentTypes(res.items.filter((d) => d.state));
      } catch {
        setDocumentTypes([]);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (!modalOpen) return;
    const biz =
      form.businessId ||
      editing?.businessId ||
      user?.businessId ||
      undefined;
    void loadDocumentTypes(biz);
  }, [
    modalOpen,
    form.businessId,
    editing?.businessId,
    user?.businessId,
    loadDocumentTypes,
  ]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const businessName = (
        businessNameById.get(row.businessId) ?? ""
      ).toLowerCase();
      return (
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        businessName.includes(q)
      );
    });
  }, [items, search, businessNameById]);

  const {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    total,
  } = useClientTablePagination(filtered);

  /** Abre modal de alta. */
  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      businessId: user?.businessId ?? "",
    });
    setModalOpen(true);
  }

  /** Abre modal de edición. */
  function openEdit(row: Training) {
    setMenuId(null);
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      validityMonths:
        row.validityMonths != null ? String(row.validityMonths) : "",
      appliesCrew: row.appliesTo.includes("crew"),
      appliesExternal: row.appliesTo.includes("external_person"),
      documentTypeId: row.documentTypeId ?? "",
      businessId: row.businessId,
      active: row.active,
    });
    setModalOpen(true);
  }

  /** Cierra modal si no envía. */
  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditing(null);
  }

  /** Arma appliesTo desde checkboxes. */
  function buildAppliesTo(): TrainingAppliesTo[] {
    const tags: TrainingAppliesTo[] = [];
    if (form.appliesCrew) tags.push("crew");
    if (form.appliesExternal) tags.push("external_person");
    return tags;
  }

  /** POST o PATCH. */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || submitting) return;

    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{0,14}$/.test(code)) {
      showToast(
        "Código: 1–15 caracteres (letras, dígitos, guión).",
        "danger",
      );
      return;
    }
    if (!form.name.trim()) {
      showToast("El nombre es requerido.", "danger");
      return;
    }
    const appliesTo = buildAppliesTo();
    if (appliesTo.length === 0) {
      showToast("Marcá al menos a quién aplica.", "danger");
      return;
    }

    let validityMonths: number | null = null;
    if (form.validityMonths.trim()) {
      const n = Number(form.validityMonths);
      if (!Number.isInteger(n) || n < 1) {
        showToast("Vigencia: meses enteros ≥ 1, o vacío.", "danger");
        return;
      }
      validityMonths = n;
    }

    if (isSuperadmin && !editing && !form.businessId) {
      showToast("Elegí la empresa.", "danger");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code,
        name: form.name.trim(),
        validityMonths,
        appliesTo,
        documentTypeId: form.documentTypeId || null,
        active: form.active,
      };
      if (editing) {
        await updateTrainingRequest(accessToken, editing.id, payload);
        showToast("Capacitación actualizada.", "success");
      } else {
        await createTrainingRequest(accessToken, {
          ...payload,
          ...(isSuperadmin ? { businessId: form.businessId } : {}),
        });
        showToast("Capacitación creada.", "success");
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

  /** Abre Modal de confirmación. */
  function askDeactivate(row: Training) {
    setMenuId(null);
    setPendingDeactivate(row);
  }

  /** Soft-delete (tras Modal). */
  async function confirmDeactivate() {
    if (!accessToken || !canManage || !pendingDeactivate || deactivating) {
      return;
    }
    setDeactivating(true);
    try {
      await deleteTrainingRequest(accessToken, pendingDeactivate.id);
      showToast("Capacitación desactivada.", "success");
      setPendingDeactivate(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo desactivar.",
        "danger",
      );
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Prevención"
        breadcrumbIcon={GraduationCap}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Capacitaciones" },
          ]}
          title="Capacitaciones"
          description="Catálogo de capacitaciones del módulo Prevención (distinto de cursos OMI)."
          actions={
            canManage ? (
              <Button
                type="button"
                size="medium"
                className="!w-auto"
                onClick={openCreate}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                Nueva capacitación
              </Button>
            ) : null
          }
        />

        <DataTableCard
          toolbar={
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar código o nombre…"
            />
          }
          footer={
            <TablePagination
              totalLabel={
                loading
                  ? "Cargando…"
                  : `${total} ${total === 1 ? "capacitación" : "capacitaciones"}`
              }
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--color-nachipa-bg-page)] text-[12px] text-[var(--color-nachipa-secondary)]">
                <th className="rounded-tl-[var(--radius-md)] px-3 py-2.5 font-medium">
                  Código
                </th>
                <th className="px-3 py-2.5 font-medium">Nombre</th>
                <th className="px-3 py-2.5 font-medium">Empresa</th>
                <th className="px-3 py-2.5 font-medium">Vigencia</th>
                <th className="px-3 py-2.5 font-medium">Aplica a</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="rounded-tr-[var(--radius-md)] px-3 py-2.5 text-right font-medium">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-[var(--color-nachipa-secondary)]"
                  >
                    No hay capacitaciones.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-tremor-border)] hover:bg-[var(--color-nachipa-bg-page)]"
                  >
                    <td className="px-3 py-2.5 font-semibold text-[var(--color-nachipa-title)]">
                      {row.code}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-title)]">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-secondary)]">
                      {businessNameById.get(row.businessId) ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-secondary)]">
                      {row.validityMonths != null
                        ? `${row.validityMonths} meses`
                        : "Sin vencimiento"}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-secondary)]">
                      {appliesToLabel(row.appliesTo)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip tone={row.active ? "success" : "neutral"}>
                        {row.active ? "Activo" : "Inactivo"}
                      </StatusChip>
                    </td>
                    <td className="relative px-3 py-2.5 text-right">
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nachipa-secondary)] hover:bg-white hover:text-[var(--color-nachipa-title)]"
                            aria-label="Acciones"
                            onClick={() =>
                              setMenuId((id) => (id === row.id ? null : row.id))
                            }
                          >
                            <MoreVertical
                              className="size-4"
                              strokeWidth={1.5}
                              aria-hidden
                            />
                          </button>
                          {menuId === row.id ? (
                            <div className="absolute right-3 z-10 mt-1 min-w-[140px] rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white py-1 shadow-sm">
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                                onClick={() => openEdit(row)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-status-danger-fg)] hover:bg-[var(--color-nachipa-bg-page)]"
                                onClick={() => askDeactivate(row)}
                              >
                                Desactivar
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableCard>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        icon={GraduationCap}
        title={editing ? "Editar capacitación" : "Nueva capacitación"}
        subtitle="Código, vigencia y a quién aplica (tripulación / externo)."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={closeModal}
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="training-form"
              size="medium"
              className="!w-auto"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        }
      >
        <form
          id="training-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => void onSubmit(e)}
        >
          {isSuperadmin && !editing ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Empresa
              </span>
              <select
                className={selectClass}
                required
                value={form.businessId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    businessId: e.target.value,
                    documentTypeId: "",
                  }))
                }
              >
                <option value="">Seleccionar…</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Código"
              name="code"
              required
              maxLength={15}
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  code: e.target.value.toUpperCase(),
                }))
              }
              placeholder="EXT-01"
              disabled={Boolean(editing)}
            />
            <TextField
              label="Vigencia (meses)"
              name="validityMonths"
              inputMode="numeric"
              value={form.validityMonths}
              onChange={(e) =>
                setForm((f) => ({ ...f, validityMonths: e.target.value }))
              }
              placeholder="Vacío = sin vencimiento"
            />
          </div>

          <TextField
            label="Nombre"
            name="name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          <fieldset className="m-0 flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] p-3">
            <legend className="px-1 text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Aplica a
            </legend>
            <label className="flex items-center gap-2 text-[13px] text-[var(--color-nachipa-body)]">
              <input
                type="checkbox"
                checked={form.appliesCrew}
                onChange={(e) =>
                  setForm((f) => ({ ...f, appliesCrew: e.target.checked }))
                }
              />
              Tripulación
            </label>
            <label className="flex items-center gap-2 text-[13px] text-[var(--color-nachipa-body)]">
              <input
                type="checkbox"
                checked={form.appliesExternal}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    appliesExternal: e.target.checked,
                  }))
                }
              />
              Persona externa
            </label>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Tipo de documento (opcional)
            </span>
            <select
              className={selectClass}
              value={form.documentTypeId}
              onChange={(e) =>
                setForm((f) => ({ ...f, documentTypeId: e.target.value }))
              }
            >
              <option value="">Ninguno</option>
              {documentTypes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>
          </label>

          {editing ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Activo
              </span>
              <Toggle
                checked={form.active}
                aria-label="Activo"
                onChange={(checked) =>
                  setForm((f) => ({ ...f, active: checked }))
                }
              />
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={pendingDeactivate !== null}
        onClose={() => {
          if (!deactivating) setPendingDeactivate(null);
        }}
        title="Desactivar capacitación"
        subtitle={
          pendingDeactivate
            ? `¿Desactivar «${pendingDeactivate.code}»? Quedará inactiva en el catálogo.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deactivating}
              onClick={() => setPendingDeactivate(null)}
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={deactivating}
              onClick={() => {
                void confirmDeactivate();
              }}
            >
              {deactivating ? "Desactivando…" : "Desactivar"}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
          No se borra el historial de asignaciones.
        </p>
      </Modal>
    </div>
  );
}
