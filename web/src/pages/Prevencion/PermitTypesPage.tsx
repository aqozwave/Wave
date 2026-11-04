import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { FileStack, MoreVertical, Plus } from "lucide-react";
import { Link } from "react-router";
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
  createPermitTypeRequest,
  deletePermitTypeRequest,
  listPermitTypesRequest,
  updatePermitTypeRequest,
  type PermitAstMode,
  type PermitCriticality,
  type PermitType,
} from "../../lib/api/permitTypes";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Etiqueta de criticidad para chip. */
function criticalityLabel(c: PermitCriticality): string {
  if (c === "high") return "Alta";
  if (c === "medium") return "Media";
  return "Baja";
}

/** Tono del chip según criticidad. */
function criticalityTone(
  c: PermitCriticality,
): "danger" | "warning" | "neutral" {
  if (c === "high") return "danger";
  if (c === "medium") return "warning";
  return "neutral";
}

/** Form create / edit del encabezado del tipo. */
type FormState = {
  code: string;
  name: string;
  criticality: PermitCriticality;
  requiresAst: boolean;
  astMode: PermitAstMode | "";
  description: string;
  businessId: string;
  active: boolean;
};

/** Form vacío para alta. */
const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  criticality: "medium",
  requiresAst: false,
  astMode: "",
  description: "",
  businessId: "",
  active: true,
};

/** Clase de selects del modal. */
const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

/**
 * Listado de tipos de permiso (P1 / P14) con CRUD de encabezado.
 * Click en código → ficha exigencias/checklist. Mutaciones: admin/superadmin.
 */
export function PermitTypesPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";
  /** API exige requireTenantManager (admin/superadmin). */
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";

  const [items, setItems] = useState<PermitType[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PermitType | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<PermitType | null>(
    null,
  );
  const [deactivating, setDeactivating] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await listPermitTypesRequest(accessToken, 1, 100);
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar tipos de permiso",
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
    if (!accessToken || !isSuperadmin) return;
    void listBusinessesRequest(accessToken)
      .then((res) => setBusinesses(res.items))
      .catch(() => setBusinesses([]));
  }, [accessToken, isSuperadmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q),
    );
  }, [items, search]);

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

  /** Abre modal de edición con el tipo. */
  function openEdit(row: PermitType) {
    setMenuId(null);
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      criticality: row.criticality,
      requiresAst: row.requiresAst,
      astMode: row.astMode ?? "",
      description: row.description ?? "",
      businessId: row.businessId,
      active: row.active,
    });
    setModalOpen(true);
  }

  /** Cierra modal si no está enviando. */
  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditing(null);
  }

  /** POST o PATCH según modo. */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || submitting) return;

    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z]{2,4}$/.test(code)) {
      showToast("El código debe tener 2 a 4 letras.", "danger");
      return;
    }
    if (!form.name.trim()) {
      showToast("El nombre es requerido.", "danger");
      return;
    }
    if (form.requiresAst && !form.astMode) {
      showToast("Elegí el modo AST (formulario, PDF o ambos).", "danger");
      return;
    }
    if (isSuperadmin && !editing && !form.businessId) {
      showToast("Elegí la empresa.", "danger");
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await updatePermitTypeRequest(accessToken, editing.id, {
          code,
          name: form.name.trim(),
          criticality: form.criticality,
          requiresAst: form.requiresAst,
          astMode: form.requiresAst ? (form.astMode as PermitAstMode) : null,
          description: form.description.trim() || undefined,
          active: form.active,
        });
        showToast("Tipo actualizado.", "success");
      } else {
        await createPermitTypeRequest(accessToken, {
          code,
          name: form.name.trim(),
          criticality: form.criticality,
          requiresAst: form.requiresAst,
          astMode: form.requiresAst ? (form.astMode as PermitAstMode) : null,
          description: form.description.trim() || undefined,
          ...(isSuperadmin ? { businessId: form.businessId } : {}),
          active: form.active,
        });
        showToast("Tipo creado.", "success");
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

  /** Abre Modal de confirmación para desactivar. */
  function askDeactivate(row: PermitType) {
    setMenuId(null);
    setPendingDeactivate(row);
  }

  /** Soft-delete del tipo (tras Modal). */
  async function confirmDeactivate() {
    if (!accessToken || !canManage || !pendingDeactivate || deactivating) {
      return;
    }
    setDeactivating(true);
    try {
      await deletePermitTypeRequest(accessToken, pendingDeactivate.id);
      showToast("Tipo desactivado.", "success");
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
        breadcrumbIcon={FileStack}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Tipos de permiso" },
          ]}
          title="Tipos de permiso"
          description="Catálogo por empresa. Abrí un tipo para ver exigencias y checklist."
          actions={
            canManage ? (
              <Button
                type="button"
                size="medium"
                className="!w-auto"
                onClick={openCreate}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                Nuevo tipo
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
                  : `${total} ${total === 1 ? "tipo" : "tipos"}`
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
                <th className="px-3 py-2.5 font-medium">Criticidad</th>
                <th className="px-3 py-2.5 font-medium">AST</th>
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
                    colSpan={6}
                    className="px-3 py-8 text-center text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-[var(--color-nachipa-secondary)]"
                  >
                    No hay tipos de permiso.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-tremor-border)] hover:bg-[var(--color-nachipa-bg-page)]"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/prevencion/tipos/${row.id}`}
                        className="font-semibold text-[var(--color-nachipa-primary)] hover:underline"
                      >
                        {row.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-title)]">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip tone={criticalityTone(row.criticality)}>
                        {criticalityLabel(row.criticality)}
                      </StatusChip>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-secondary)]">
                      {row.requiresAst ? (row.astMode ?? "sí") : "No"}
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
        icon={FileStack}
        title={editing ? "Editar tipo de permiso" : "Nuevo tipo de permiso"}
        subtitle="Código corto, criticidad y si exige AST."
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
              form="permit-type-form"
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
          id="permit-type-form"
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
                  setForm((f) => ({ ...f, businessId: e.target.value }))
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
              maxLength={4}
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  code: e.target.value.toUpperCase(),
                }))
              }
              placeholder="CAL"
              disabled={Boolean(editing)}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Criticidad
              </span>
              <select
                className={selectClass}
                value={form.criticality}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    criticality: e.target.value as PermitCriticality,
                  }))
                }
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </label>
          </div>

          <TextField
            label="Nombre"
            name="name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Trabajos en caliente"
          />

          <TextField
            label="Descripción"
            name="description"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />

          <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Exige AST
              </span>
              <Toggle
                checked={form.requiresAst}
                aria-label="Exige AST"
                onChange={(checked) =>
                  setForm((f) => ({
                    ...f,
                    requiresAst: checked,
                    astMode: checked ? f.astMode || "form" : "",
                  }))
                }
              />
            </div>
            {form.requiresAst ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Modo AST
                </span>
                <select
                  className={selectClass}
                  value={form.astMode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      astMode: e.target.value as PermitAstMode | "",
                    }))
                  }
                >
                  <option value="form">Formulario</option>
                  <option value="pdf">PDF</option>
                  <option value="both">Ambos</option>
                </select>
              </label>
            ) : null}
          </div>

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
        title="Desactivar tipo de permiso"
        subtitle={
          pendingDeactivate
            ? `¿Desactivar «${pendingDeactivate.code}»? Quedará inactivo y no se ofrecerá en permisos nuevos.`
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
          Exigencias e historial se conservan.
        </p>
      </Modal>
    </div>
  );
}
