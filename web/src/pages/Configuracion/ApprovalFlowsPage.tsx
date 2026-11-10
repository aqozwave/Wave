import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown, GitBranch, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router";
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
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  createApprovalFlowRequest,
  deleteApprovalFlowRequest,
  listApprovalFlowsRequest,
  updateApprovalFlowRequest,
  type ApprovalFlowListItem,
} from "../../lib/api/approvalFlows";
import {
  listBusinessesRequest,
  type Business,
} from "../../lib/api/businesses";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/**
 * Select con chevron Lucide visible (no depende del browser).
 */
function FieldSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block w-full">
      <select
        {...props}
        className={[
          "h-[42px] w-full appearance-none rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 pr-10 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]",
          className ?? "",
        ].join(" ")}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.5}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-icon-default)]"
        aria-hidden
      />
    </span>
  );
}

/** Fecha corta es-CL. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL");
  } catch {
    return "—";
  }
}

/**
 * P16 · Listado de flujos de aprobación (Configuración · Superadmin).
 */
export function ApprovalFlowsPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isSuperadmin = user?.internalRol === "superadmin";

  const [items, setItems] = useState<ApprovalFlowListItem[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState(user?.businessId ?? "");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState("EST-C");
  const [name, setName] = useState("Estándar + cierre");
  const [description, setDescription] = useState(
    "Estándar con una etapa extra de cierre del trabajo",
  );
  /** Cantidad de etapas al crear (1–8); default 6 = EST + cierre. */
  const [stageCount, setStageCount] = useState(6);
  const [submitting, setSubmitting] = useState(false);

  /** Editar nombre/descripción desde la lista. */
  const [editRow, setEditRow] = useState<ApprovalFlowListItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  /** Soft-delete. */
  const [deleteRow, setDeleteRow] = useState<ApprovalFlowListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !isSuperadmin) return;
    setLoading(true);
    try {
      const result = await listApprovalFlowsRequest(accessToken, 1, 100, {
        businessId: businessId || undefined,
      });
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudieron cargar flujos",
        "danger",
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, isSuperadmin, businessId, showToast]);

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
  } = useClientTablePagination(filtered, 10);

  const kpis = useMemo(() => {
    const active = items.filter((i) => i.active).length;
    const system = items.filter((i) => i.isSystem).length;
    const custom = items.filter((i) => !i.isSystem).length;
    const types = items.reduce((acc, i) => acc + i.typeCount, 0);
    return { active, system, custom, types };
  }, [items]);

  function openCreate() {
    setCode("EST-C");
    setName("Estándar + cierre");
    setDescription("Estándar con una etapa extra de cierre del trabajo");
    setStageCount(6);
    setModalOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    const biz = businessId || user?.businessId;
    if (!biz) {
      showToast("Elegí una empresa", "danger");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createApprovalFlowRequest(accessToken, {
        businessId: biz,
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null,
        stageCount,
      });
      showToast(`Flujo ${created.code} creado`, "success");
      setModalOpen(false);
      void navigate(`/configuracion/flujos/${created.id}`);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo crear el flujo",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(row: ApprovalFlowListItem) {
    setEditRow(row);
    setEditName(row.name);
    setEditDescription(row.description ?? "");
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !editRow) return;
    setSubmitting(true);
    try {
      await updateApprovalFlowRequest(accessToken, editRow.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      showToast("Flujo actualizado", "success");
      setEditRow(null);
      void load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirmDelete() {
    if (!accessToken || !deleteRow) return;
    setDeleting(true);
    try {
      await deleteApprovalFlowRequest(accessToken, deleteRow.id);
      showToast(`Flujo ${deleteRow.code} eliminado`, "success");
      setDeleteRow(null);
      void load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar",
        "danger",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!isSuperadmin) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Configuración"
          breadcrumbIcon={GitBranch}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Solo Superadmin puede gestionar flujos de aprobación.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Configuración"
        breadcrumbIcon={GitBranch}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader
          crumbs={[
            { label: "Configuración" },
            { label: "Flujos de aprobación" },
          ]}
          title="Flujos de aprobación"
          description="Plantillas de etapas para permisos de trabajo. El Estándar es de sistema; las copias son editables (máx. 8 etapas)."
          actions={
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              onClick={openCreate}
            >
              <Plus size={16} strokeWidth={1.5} aria-hidden />
              Nuevo flujo
            </Button>
          }
        />

        {businesses.length > 1 ? (
          <label className="flex max-w-xs flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Empresa
            </span>
            <FieldSelect
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              autoComplete="off"
              name="filterBusinessId"
              aria-label="Filtrar por empresa"
            >
              <option value="">Todas</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </FieldSelect>
          </label>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Flujos activos"
            value={String(kpis.active)}
            hint="Estándar y personalizados"
          />
          <KpiCard
            label="Del sistema"
            value={String(kpis.system)}
            hint="sistema no editable"
          />
          <KpiCard
            label="Personalizados"
            value={String(kpis.custom)}
            hint="creados por el Superadmin"
          />
          <KpiCard
            label="Tipos asignados"
            value={String(kpis.types)}
            hint="tipos de permiso con flujo"
          />
        </div>

        <DataTableCard
          toolbar={
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar por código o nombre…"
            />
          }
        >
          {loading ? (
            <p className="m-0 px-4 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
              Cargando flujos…
            </p>
          ) : filtered.length === 0 ? (
            <p className="m-0 px-4 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
              No hay flujos. Creá una copia del Estándar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg,#f8f9fb)]">
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Código
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Flujo
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Etapas
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Tipos
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Origen
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Estado
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Actualizado
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--color-nachipa-border-subtle)]"
                    >
                      <td className="h-12 px-4">
                        <Link
                          to={`/configuracion/flujos/${row.id}`}
                          className="font-medium text-[var(--color-nachipa-primary)] hover:underline"
                        >
                          {row.code}
                        </Link>
                      </td>
                      <td className="h-12 px-4 text-[var(--color-nachipa-title)]">
                        {row.name}
                        <span className="ml-1.5 text-[12px] text-[var(--color-nachipa-secondary)]">
                          {row.isSystem ? "(Del sistema)" : "(Personalizado)"}
                        </span>
                      </td>
                      <td className="h-12 px-4 tabular-nums">
                        {row.stageCount}
                      </td>
                      <td className="h-12 px-4 tabular-nums">
                        {row.typeCount} tipo{row.typeCount === 1 ? "" : "s"}
                      </td>
                      <td className="h-12 px-4 text-[var(--color-nachipa-body)]">
                        {row.isSystem ? "Sistema" : "Superadmin"}
                      </td>
                      <td className="h-12 px-4">
                        <StatusChip tone={row.active ? "success" : "neutral"}>
                          {row.active ? "Activo" : "Inactivo"}
                        </StatusChip>
                      </td>
                      <td className="h-12 px-4 text-[var(--color-nachipa-secondary)]">
                        {row.isSystem ? "—" : formatDate(row.updatedAt)}
                      </td>
                      <td className="h-12 px-4">
                        <span className="inline-flex flex-wrap gap-2">
                          <Link
                            to={`/configuracion/flujos/${row.id}`}
                            className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                          >
                            {row.isSystem ? "Ver" : "Editar etapas"}
                          </Link>
                          {!row.isSystem ? (
                            <>
                              <button
                                type="button"
                                className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                                onClick={() => openEdit(row)}
                              >
                                Editar datos
                              </button>
                              <button
                                type="button"
                                className="text-[13px] font-medium text-[var(--color-status-danger,#b42318)] hover:underline"
                                onClick={() => setDeleteRow(row)}
                              >
                                Eliminar
                              </button>
                            </>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <TablePagination
            totalLabel={
              loading
                ? "Cargando…"
                : `${filtered.length} ${filtered.length === 1 ? "flujo" : "flujos"}`
            }
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </DataTableCard>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo flujo"
        subtitle="Crea una copia editable del flujo Estándar"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => void onSubmit(e)}
          autoComplete="off"
        >
          {businesses.length > 1 ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Empresa *
              </span>
              <FieldSelect
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                required
                autoComplete="off"
                name="flowBusinessId"
              >
                <option value="">Elegí empresa…</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </FieldSelect>
            </label>
          ) : null}
          <TextField
            label="Código *"
            name="flowCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoComplete="off"
          />
          <TextField
            label="Nombre *"
            name="flowName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="off"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Cantidad de etapas *
            </span>
            <FieldSelect
              name="flowStageCount"
              autoComplete="off"
              value={stageCount}
              onChange={(e) => setStageCount(Number(e.target.value))}
              required
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} etapa{n === 1 ? "" : "s"}
                </option>
              ))}
            </FieldSelect>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Descripción
            </span>
            <textarea
              name="flowDescription"
              autoComplete="off"
              className="h-20 w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 py-2 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </label>
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Basado en: <strong className="font-medium text-[var(--color-nachipa-title)]">Estándar</strong>
          </p>
          <p className="m-0 rounded-[var(--radius-md)] border border-[var(--color-brand-sky)]/30 bg-[color-mix(in_srgb,var(--color-brand-sky)_8%,white)] px-3 py-2 text-[12px] text-[var(--color-nachipa-body)]">
            Hasta 5 etapas se copian del Estándar. Si elegís más, se agregan
            etapas editables para completar (máximo 8).
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </button>
            <Button type="submit" className="!h-9 !w-auto" disabled={submitting}>
              {submitting ? "Creando…" : "Crear flujo"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editRow)}
        onClose={() => {
          if (!submitting) setEditRow(null);
        }}
        title="Editar flujo"
        subtitle={editRow ? `${editRow.code} · datos generales` : undefined}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => void onSaveEdit(e)}
          autoComplete="off"
        >
          <TextField
            label="Nombre *"
            name="editFlowName"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoComplete="off"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Descripción
            </span>
            <textarea
              name="editFlowDescription"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              autoComplete="off"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 py-2.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]"
            />
          </label>
          <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
            Para cambiar etapas usá «Editar etapas» en la fila.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium"
              onClick={() => setEditRow(null)}
              disabled={submitting}
            >
              Cancelar
            </button>
            <Button type="submit" className="!h-9 !w-auto" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteRow)}
        onClose={() => {
          if (!deleting) setDeleteRow(null);
        }}
        title="Eliminar flujo"
        subtitle={
          deleteRow
            ? `${deleteRow.code} · ${deleteRow.name}`
            : undefined
        }
        maxWidthClass="max-w-[440px]"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteRow(null)}
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium"
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={deleting}
              onClick={() => void onConfirmDelete()}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[13px] text-[var(--color-nachipa-body)]">
          Se da de baja el flujo personalizado
          {deleteRow && deleteRow.typeCount > 0
            ? ` (tiene ${deleteRow.typeCount} tipo${deleteRow.typeCount === 1 ? "" : "s"} asignado${deleteRow.typeCount === 1 ? "" : "s"})`
            : ""}
          . El Estándar del sistema no se puede eliminar.
        </p>
      </Modal>
    </div>
  );
}

/** Tarjeta KPI compacta del listado P16. */
function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white px-4 py-3.5">
      <span className="text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
        {label}
      </span>
      <p className="m-0 text-[20px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
        {value}
      </p>
      <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
        {hint}
      </p>
    </div>
  );
}
