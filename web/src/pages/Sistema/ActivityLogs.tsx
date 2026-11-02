import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ClipboardList } from "lucide-react";
import {
  DataTableCard,
} from "../../components/DataTableCard/DataTableCard";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import {
  StatusChip,
  type StatusChipTone,
} from "../../components/StatusChip/StatusChip";
import { TableHeaderCell } from "../../components/TableHeaderCell/TableHeaderCell";
import { TablePagination } from "../../components/TablePagination/TablePagination";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import {
  listActivityLogsRequest,
  type ActivityAction,
  type ActivityLog,
  type ActivityResource,
} from "../../lib/api/activityLogs";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Opciones de filtro de acción. */
const ACTION_OPTIONS: Array<{ value: "" | ActivityAction; label: string }> = [
  { value: "", label: "Todas las acciones" },
  { value: "LOGIN", label: "Inicio de sesión" },
  { value: "LOGOUT", label: "Cierre de sesión" },
  { value: "REGISTER", label: "Registro" },
  { value: "CREATE", label: "Creación" },
  { value: "UPDATE", label: "Actualización" },
  { value: "DELETE", label: "Eliminación" },
];

/** Opciones de filtro de recurso (subset útil al inicio). */
const RESOURCE_OPTIONS: Array<{ value: "" | ActivityResource; label: string }> =
  [
    { value: "", label: "Todos los recursos" },
    { value: "auth", label: "Autenticación" },
    { value: "user", label: "Usuario" },
    { value: "business", label: "Empresa" },
    { value: "location", label: "Lugar de trabajo" },
    { value: "crewMember", label: "Embarcado" },
    { value: "crewMemberCourse", label: "Curso tripulante" },
    { value: "area", label: "Área" },
    { value: "rank", label: "Cargo" },
    { value: "academicDegree", label: "Título académico" },
    { value: "competencyCertificate", label: "Título marítimo" },
    { value: "documentType", label: "Tipo de documento" },
    { value: "muelle", label: "Muelle" },
    { value: "travesia", label: "Travesía" },
    { value: "port", label: "Puerto" },
    { value: "course", label: "Curso OMI" },
    { value: "role", label: "Rol" },
    { value: "system", label: "Sistema" },
  ];

/** Etiquetas cortas de acción. */
const ACTION_LABELS: Record<ActivityAction, string> = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  REGISTER: "Registro",
  CREATE: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
};

/** Lee action desde URL. */
function readAction(params: URLSearchParams): "" | ActivityAction {
  const value = params.get("action");
  if (
    value === "LOGIN" ||
    value === "LOGOUT" ||
    value === "REGISTER" ||
    value === "CREATE" ||
    value === "UPDATE" ||
    value === "DELETE"
  ) {
    return value;
  }
  return "";
}

/** Lee resource desde URL. */
function readResource(params: URLSearchParams): "" | ActivityResource {
  const value = params.get("resource");
  const found = RESOURCE_OPTIONS.find((o) => o.value === value);
  return found?.value ?? "";
}

/** Lee success desde URL. */
function readSuccess(params: URLSearchParams): "" | "true" | "false" {
  const value = params.get("success");
  if (value === "true" || value === "false") return value;
  return "";
}

/** Fecha/hora es-CL. */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

/** Actor legible. */
function formatActor(row: ActivityLog): string {
  return row.actorEmail || row.actorUsername || "—";
}

/**
 * Registro de actividad (auditoría).
 * Solo superadmin. Ruta: /sistema/actividad
 */
export function ActivityLogs() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const actionFilter = readAction(searchParams);
  const resourceFilter = readResource(searchParams);
  const successFilter = readSuccess(searchParams);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  /** ¿Este usuario puede ver la pantalla? */
  const allowed = user?.internalRol === "superadmin";

  /** Sincroniza filtros en la URL. */
  function patchUrl(patch: {
    action?: "" | ActivityAction;
    resource?: "" | ActivityResource;
    success?: "" | "true" | "false";
  }) {
    const next = new URLSearchParams(searchParams);
    const merged = {
      action: actionFilter,
      resource: resourceFilter,
      success: successFilter,
      ...patch,
    };
    if (merged.action) next.set("action", merged.action);
    else next.delete("action");
    if (merged.resource) next.set("resource", merged.resource);
    else next.delete("resource");
    if (merged.success) next.set("success", merged.success);
    else next.delete("success");
    setSearchParams(next, { replace: true });
  }

  /** Carga página del listado. */
  const load = useCallback(async () => {
    if (!accessToken || !allowed) return;
    setLoading(true);
    try {
      const res = await listActivityLogsRequest(accessToken, {
        page,
        limit: pageSize,
        action: actionFilter || undefined,
        resource: resourceFilter || undefined,
        success: successFilter || undefined,
      });
      setRows(res.items);
      setTotal(res.total);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar el registro de actividad",
        "danger",
      );
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    actionFilter,
    allowed,
    page,
    pageSize,
    resourceFilter,
    showToast,
    successFilter,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  if (!allowed) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Registro de actividad"
          breadcrumbIcon={ClipboardList}
          actions={<UserMenu />}
        />
        <div className="px-6 py-8 text-[13px] text-[var(--color-nachipa-secondary)]">
          Solo el superadmin puede ver el registro de actividad.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Registro de actividad"
        breadcrumbIcon={ClipboardList}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Sistema" },
            { label: "Registro de actividad" },
          ]}
          title="Registro de actividad"
          description="Auditoría de login, logout y cambios de dominio. Hoy se escriben eventos de auth; el resto de módulos se irá conectando."
        />

        <DataTableCard
          toolbar={
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <label className="flex min-w-[180px] flex-col gap-1 text-[12px] text-[var(--color-nachipa-secondary)]">
                Acción
                <select
                  className="h-9 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[13px] text-[var(--color-nachipa-title)]"
                  value={actionFilter}
                  onChange={(e) => {
                    patchUrl({
                      action: e.target.value as "" | ActivityAction,
                    });
                    setPage(1);
                  }}
                >
                  {ACTION_OPTIONS.map((o) => (
                    <option key={o.label} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[180px] flex-col gap-1 text-[12px] text-[var(--color-nachipa-secondary)]">
                Recurso
                <select
                  className="h-9 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[13px] text-[var(--color-nachipa-title)]"
                  value={resourceFilter}
                  onChange={(e) => {
                    patchUrl({
                      resource: e.target.value as "" | ActivityResource,
                    });
                    setPage(1);
                  }}
                >
                  {RESOURCE_OPTIONS.map((o) => (
                    <option key={o.label} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[140px] flex-col gap-1 text-[12px] text-[var(--color-nachipa-secondary)]">
                Resultado
                <select
                  className="h-9 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[13px] text-[var(--color-nachipa-title)]"
                  value={successFilter}
                  onChange={(e) => {
                    patchUrl({
                      success: e.target.value as "" | "true" | "false",
                    });
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="true">Exitoso</option>
                  <option value="false">Fallido</option>
                </select>
              </label>
            </div>
          }
          footer={
            <TablePagination
              totalLabel={loading ? "Cargando…" : `${total} eventos`}
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="bg-[var(--color-nachipa-table-header,#f4f4f5)]">
                  <TableHeaderCell>Cuándo</TableHeaderCell>
                  <TableHeaderCell>Actor</TableHeaderCell>
                  <TableHeaderCell>Acción</TableHeaderCell>
                  <TableHeaderCell>Recurso</TableHeaderCell>
                  <TableHeaderCell>Detalle</TableHeaderCell>
                  <TableHeaderCell>Resultado</TableHeaderCell>
                  <TableHeaderCell>IP</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-[var(--color-nachipa-secondary)]"
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-[var(--color-nachipa-secondary)]"
                    >
                      No hay eventos con estos filtros.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const tone: StatusChipTone = row.success
                      ? "success"
                      : "danger";
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-[var(--color-tremor-border)]"
                      >
                        <td className="px-4 py-3 tabular-nums text-[var(--color-nachipa-secondary)]">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--color-nachipa-title)]">
                            {formatActor(row)}
                          </div>
                          {row.actorRole ? (
                            <div className="text-[11px] text-[var(--color-nachipa-secondary)]">
                              {row.actorRole}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-nachipa-title)]">
                          {ACTION_LABELS[row.action]}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-nachipa-secondary)]">
                          {row.resource}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-nachipa-title)]">
                          {row.targetLabel || row.errorMessage || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip tone={tone}>
                            {row.success ? "OK" : "Falló"}
                          </StatusChip>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[12px] text-[var(--color-nachipa-secondary)]">
                          {row.ip || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </DataTableCard>
      </div>
    </div>
  );
}
