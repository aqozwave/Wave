import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Plus, Shield } from "lucide-react";

import { Button } from "../../components/Button/Button";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { TableHeaderCell } from "../../components/TableHeaderCell/TableHeaderCell";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import {
  createRoleRequest,
  getPermissionCatalogRequest,
  listRolesRequest,
  updateRoleRequest,
  type PermissionCatalog,
  type Role,
} from "../../lib/api/roles";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Etiquetas de alcance (Figma / portal viejo). self = Externo. */
const SCOPE_LABELS: Record<string, string> = {
  all: "Todo el sistema",
  business: "Empresa",
  location: "Nave / lugar",
  area: "Área",
  self: "Externo",
};

/** Scopes visibles en el segmented control (Figma: 4). */
const SCOPE_OPTIONS = ["all", "business", "location", "self"] as const;

/** Columnas de acciones en la matriz. */
const ACTION_COLUMNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "read", label: "Ver" },
  { key: "create", label: "Crear" },
  { key: "update", label: "Editar" },
  { key: "deactivate", label: "Desactivar" },
];

/** permissions[] → Map resource → Set actions. */
function permissionsToMap(
  permissions: Role["permissions"],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of permissions) {
    map.set(row.resource, new Set(row.actions));
  }
  return map;
}

/** Map → permissions[] para la API. */
function mapToPermissions(
  map: Map<string, Set<string>>,
): Role["permissions"] {
  return [...map.entries()]
    .filter(([, actions]) => actions.size > 0)
    .map(([resource, actions]) => ({
      resource,
      actions: [...actions],
    }));
}

/** Cuenta módulos con al menos un permiso. */
function modulesWithAccess(
  catalog: PermissionCatalog | null,
  map: Map<string, Set<string>>,
): { withAccess: number; total: number } {
  if (!catalog) return { withAccess: 0, total: 0 };
  let total = 0;
  let withAccess = 0;
  for (const mod of catalog.catalog) {
    for (const item of mod.items) {
      total += 1;
      if ((map.get(item.resource)?.size ?? 0) > 0) withAccess += 1;
    }
  }
  return { withAccess, total };
}

/**
 * Pantalla Roles y permisos (Figma 105:1229).
 * Lista a la izquierda + editor de permisos a la derecha. Solo superadmin CRUD.
 */
export function Roles() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";

  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /** Form del editor (rol seleccionado o borrador de alta). */
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [dataScope, setDataScope] = useState<string>("business");
  const [state, setState] = useState(true);
  const [permMap, setPermMap] = useState<Map<string, Set<string>>>(new Map());
  const [isSystem, setIsSystem] = useState(false);

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId],
  );

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [rolesResult, catalogResult] = await Promise.all([
        listRolesRequest(accessToken, true),
        isSuperadmin
          ? getPermissionCatalogRequest(accessToken)
          : Promise.resolve(null),
      ]);
      setRoles(rolesResult.items);
      setCatalog(catalogResult);
      setSelectedId((prev) => {
        if (prev && rolesResult.items.some((r) => r.id === prev)) return prev;
        return rolesResult.items[0]?.id ?? null;
      });
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los roles.",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, isSuperadmin, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Al elegir rol (o salir de crear), sincroniza el form. */
  useEffect(() => {
    if (creating) return;
    if (!selected) {
      setName("");
      setKey("");
      setDescription("");
      setDataScope("business");
      setState(true);
      setPermMap(new Map());
      setIsSystem(false);
      return;
    }
    setName(selected.name);
    setKey(selected.key);
    setDescription(selected.description);
    setDataScope(selected.dataScope);
    setState(selected.state);
    setPermMap(permissionsToMap(selected.permissions));
    setIsSystem(selected.isSystem);
  }, [selected, creating]);

  function startCreate() {
    setCreating(true);
    setSelectedId(null);
    setName("");
    setKey("");
    setDescription("");
    setDataScope("business");
    setState(true);
    setPermMap(new Map());
    setIsSystem(false);
  }

  function cancelCreate() {
    setCreating(false);
    setSelectedId(roles[0]?.id ?? null);
  }

  function toggleAction(resource: string, action: string) {
    setPermMap((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(resource) ?? []);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      if (set.size === 0) next.delete(resource);
      else next.set(resource, set);
      return next;
    });
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !isSuperadmin) return;
    if (!name.trim()) {
      showToast("El nombre es requerido.", "danger");
      return;
    }

    setSubmitting(true);
    try {
      const permissions = mapToPermissions(permMap);
      if (creating) {
        const created = await createRoleRequest(accessToken, {
          name: name.trim(),
          key: key.trim() || undefined,
          description: description.trim(),
          dataScope,
          permissions,
          state,
        });
        showToast("Rol creado.", "success");
        setCreating(false);
        await load();
        setSelectedId(created.id);
      } else if (selected) {
        await updateRoleRequest(accessToken, selected.id, {
          name: name.trim(),
          description: description.trim(),
          ...(isSystem ? {} : { dataScope }),
          permissions,
          state,
        });
        showToast("Rol actualizado.", "success");
        await load();
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const { withAccess, total } = modulesWithAccess(catalog, permMap);
  const selectClass =
    "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

  if (!isSuperadmin) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Roles y permisos"
          breadcrumbIcon={Shield}
          actions={<UserMenu />}
        />
        <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-[var(--color-nachipa-secondary)]">
          Solo el superadmin puede gestionar roles y permisos.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb="Roles y permisos"
        breadcrumbIcon={Shield}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-6 pb-6 pt-4">
        <PageHeader
          crumbs={[
            { label: "Sistema" },
            { label: "Roles y permisos" },
          ]}
          title="Roles y permisos"
          description="Definí qué puede ver y hacer cada perfil. El alcance limita los datos; los checks, las acciones."
          actions={
            <Button
              type="button"
              className="!w-auto shrink-0"
              onClick={startCreate}
            >
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
              Nuevo rol
            </Button>
          }
        />

        <div className="flex min-h-0 min-w-0 flex-1 gap-4 overflow-hidden">
          {/* Lista de roles (Figma columna izquierda). */}
          <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-tremor-border)] bg-white">
            <div className="border-b border-[var(--color-tremor-border)] px-4 py-3">
              <h2 className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                Roles
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loading ? (
                <p className="px-2 py-4 text-[13px] text-[var(--color-nachipa-secondary)]">
                  Cargando…
                </p>
              ) : null}
              {roles.map((role) => {
                const map = permissionsToMap(role.permissions);
                const stats = modulesWithAccess(catalog, map);
                const active = !creating && role.id === selectedId;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setSelectedId(role.id);
                    }}
                    className={[
                      "mb-1 flex w-full flex-col gap-1.5 rounded-[var(--radius-md)] px-3 py-2.5 text-left",
                      active
                        ? "bg-[var(--color-nachipa-tab,#f4f4f5)]"
                        : "hover:bg-[var(--color-nachipa-bg-page)]",
                    ].join(" ")}
                  >
                    <span className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                      {role.name}
                    </span>
                    <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                      {role.key} ·{" "}
                      {SCOPE_LABELS[role.dataScope] ?? role.dataScope}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-nachipa-bg-page)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-nachipa-primary,#004c8c)]"
                          style={{
                            width: `${stats.total ? (stats.withAccess / stats.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-nachipa-muted)]">
                        {stats.withAccess}/{stats.total}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-[var(--color-tremor-border)] px-4 py-3 text-[11px] leading-4 text-[var(--color-nachipa-secondary)]">
              <p className="mb-1 font-semibold text-[var(--color-nachipa-title)]">
                Alcance de datos
              </p>
              <p>Todo el sistema · Empresa · Nave/lugar · Externo</p>
            </div>
          </aside>

          {/* Editor (Figma panel derecho). */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--color-tremor-border)] bg-white">
            {!creating && !selected ? (
              <div className="flex flex-1 items-center justify-center text-[13px] text-[var(--color-nachipa-secondary)]">
                Seleccioná un rol o creá uno nuevo.
              </div>
            ) : (
              <form
                onSubmit={onSave}
                className="flex min-h-0 flex-1 flex-col"
                noValidate
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-tremor-border)] px-5 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Shield
                      className="size-5 shrink-0 text-[var(--color-icon-default)]"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <h2 className="truncate text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                      {creating
                        ? "Nuevo rol"
                        : `Editar rol · ${selected?.name ?? ""}`}
                    </h2>
                    {isSystem ? (
                      <span className="rounded-full bg-[var(--color-nachipa-tab,#f4f4f5)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-nachipa-secondary)]">
                        Rol de sistema
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                      Rol activo
                    </span>
                    <Toggle
                      checked={state}
                      onChange={setState}
                      aria-label="Rol activo"
                    />
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField
                      label="Nombre *"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <TextField
                      label="Clave"
                      name="key"
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      disabled={!creating || isSystem}
                      placeholder="se-deriva-del-nombre"
                    />
                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                        Descripción
                      </span>
                      <textarea
                        className={`${selectClass} h-20 resize-none py-2`}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={300}
                      />
                    </label>
                  </div>

                  <div className="mb-5">
                    <p className="mb-2 text-[13px] font-medium text-[var(--color-nachipa-title)]">
                      Alcance de datos
                    </p>
                    <div
                      className="inline-flex flex-wrap gap-1 rounded-[var(--radius-md)] bg-[var(--color-nachipa-bg-page)] p-1"
                      role="group"
                      aria-label="Alcance de datos"
                    >
                      {SCOPE_OPTIONS.map((scope) => {
                        const active = dataScope === scope;
                        return (
                          <button
                            key={scope}
                            type="button"
                            disabled={isSystem}
                            onClick={() => setDataScope(scope)}
                            className={[
                              "rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] font-medium",
                              active
                                ? "bg-white text-[var(--color-nachipa-title)] shadow-sm"
                                : "text-[var(--color-nachipa-secondary)]",
                              isSystem ? "opacity-60" : "",
                            ].join(" ")}
                          >
                            {SCOPE_LABELS[scope]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-tremor-border)]">
                    <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
                      <thead>
                        <tr>
                          {/* Módulo: redondeado izquierdo (Figma TableHeaderCell). */}
                          <TableHeaderCell rounded="left">Módulo</TableHeaderCell>
                          {ACTION_COLUMNS.map((col, i) => {
                            /* La última columna de acción lleva radio derecho (Figma). */
                            const isLast = i === ACTION_COLUMNS.length - 1;
                            return (
                              <th
                                key={col.key}
                                className={[
                                  "h-9 w-20 border-b border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg,#f8f9fb)] px-2 text-center text-[12px] font-semibold text-[var(--color-table-head-text,#6b6b73)]",
                                  isLast ? "rounded-r-lg" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                {col.label}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {catalog?.catalog.map((mod) => (
                          <Fragment key={mod.module}>
                            <tr>
                              <td
                                colSpan={5}
                                className="bg-[var(--color-nachipa-bg-page)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-nachipa-muted)]"
                              >
                                {mod.module}
                              </td>
                            </tr>
                            {mod.items.map((item) => (
                              <tr
                                key={item.resource}
                                className="border-t border-[var(--color-nachipa-border-subtle)]"
                              >
                                <td className="h-10 px-3 text-[var(--color-nachipa-title)]">
                                  <span className="inline-flex flex-wrap items-baseline gap-2">
                                    <span className="text-[13px] font-medium">
                                      {item.label}
                                    </span>
                                    {item.hint ? (
                                      <span className="text-[12px] font-normal text-[var(--color-nachipa-secondary)]">
                                        {item.hint}
                                      </span>
                                    ) : null}
                                  </span>
                                </td>
                                {ACTION_COLUMNS.map((col) => {
                                  const allowed = item.actions.includes(
                                    col.key,
                                  );
                                  const checked =
                                    permMap.get(item.resource)?.has(col.key) ??
                                    false;
                                  return (
                                    <td
                                      key={col.key}
                                      className="h-10 px-2 text-center"
                                    >
                                      {allowed ? (
                                        <input
                                          type="checkbox"
                                          className="size-4 accent-[var(--color-nachipa-primary,#004c8c)]"
                                          checked={checked}
                                          onChange={() =>
                                            toggleAction(
                                              item.resource,
                                              col.key,
                                            )
                                          }
                                          aria-label={`${item.label} ${col.label}`}
                                        />
                                      ) : (
                                        <span className="text-[var(--color-nachipa-muted)]">
                                          —
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--color-tremor-border)] px-5 py-3">
                  <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                    {withAccess} de {total} módulos con acceso
                  </p>
                  <div className="flex gap-3">
                    {creating ? (
                      <button
                        type="button"
                        onClick={cancelCreate}
                        disabled={submitting}
                        className="inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab,#f4f4f5)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    ) : null}
                    <Button
                      type="submit"
                      className="!h-9 !w-auto"
                      disabled={submitting}
                    >
                      {submitting
                        ? "Guardando…"
                        : creating
                          ? "Crear rol"
                          : "Guardar cambios"}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
