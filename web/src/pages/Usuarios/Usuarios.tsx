import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { MoreVertical, Plus, Search, Users } from "lucide-react";

import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { listAreasRequest, type Area } from "../../lib/api/areas";
import { listBusinessesRequest, type Business } from "../../lib/api/businesses";
import { listLocationsRequest, type Location } from "../../lib/api/locations";
import { listRolesRequest, type Role } from "../../lib/api/roles";
import {
  createUserRequest,
  deleteUserRequest,
  listUsersRequest,
  unlockUserRequest,
  updateUserRequest,
  type AdminUser,
} from "../../lib/api/users";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Form create / edit. */
type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  run: string;
  password: string;
  businessId: string;
  roleId: string;
  locationId: string;
  areaId: string;
  state: boolean;
};

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  run: "",
  password: "",
  businessId: "",
  roleId: "",
  locationId: "",
  areaId: "",
  state: true,
};

/** Nombre completo para tabla. */
function fullName(row: AdminUser): string {
  return `${row.firstName} ${row.lastName}`.trim() || "—";
}

/** True si lockUntil está en el futuro. */
function isLocked(row: AdminUser): boolean {
  if (!row.lockUntil) return false;
  return new Date(row.lockUntil).getTime() > Date.now();
}

/**
 * Pantalla Usuarios (Configuración).
 * Lista + modal alta/edición; rol, empresa, lugar y área.
 */
export function Usuarios() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";

  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await listUsersRequest(accessToken, {
        page: 1,
        limit: 100,
        includeInactive: true,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los usuarios.",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, showToast]);

  /** Filtro local sobre el lote cargado (misma UX que Empresas). */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) =>
      [
        row.firstName,
        row.lastName,
        row.email,
        row.username,
        row.run,
        row.role?.name,
        row.business?.name,
        row.internalRol,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  /** Catálogos para selects del modal. */
  const loadCatalogs = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [biz, roleList, locs, areaList] = await Promise.all([
        listBusinessesRequest(accessToken),
        listRolesRequest(accessToken, false),
        listLocationsRequest(accessToken),
        listAreasRequest(accessToken),
      ]);
      setBusinesses(biz.items);
      setRoles(roleList.items);
      setLocations(locs.items);
      setAreas(areaList.items);
    } catch {
      // Los selects quedan vacíos; el listado de usuarios igual carga.
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  /** Locations filtradas por empresa del form. */
  const locationsForForm = useMemo(() => {
    if (!form.businessId) return locations;
    return locations.filter((l) => l.businessId === form.businessId);
  }, [locations, form.businessId]);

  /** Áreas filtradas por location del form. */
  const areasForForm = useMemo(() => {
    if (!form.locationId) return areas;
    return areas.filter((a) => a.locationId === form.locationId);
  }, [areas, form.locationId]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      businessId: isSuperadmin ? "" : (user?.businessId ?? ""),
    });
    setModalOpen(true);
  }

  function openEdit(row: AdminUser) {
    setEditing(row);
    setMenuId(null);
    setForm({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      username: row.username,
      run: row.run,
      password: "",
      businessId: row.businessId ?? "",
      roleId: row.roleId ?? "",
      locationId: row.locationId ?? "",
      areaId: row.areaId ?? "",
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
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Cascada: cambiar empresa limpia location/area.
      if (key === "businessId") {
        next.locationId = "";
        next.areaId = "";
      }
      if (key === "locationId") {
        next.areaId = "";
      }
      return next;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;

    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast("Nombre y apellido son requeridos.", "danger");
      return;
    }
    if (!form.email.trim() || !form.username.trim() || !form.run.trim()) {
      showToast("Email, usuario y RUN son requeridos.", "danger");
      return;
    }
    if (!editing && form.password.length < 8) {
      showToast("La contraseña debe tener al menos 8 caracteres.", "danger");
      return;
    }
    if (isSuperadmin && !form.businessId && form.roleId) {
      const role = roles.find((r) => r.id === form.roleId);
      if (role && role.key !== "superadmin") {
        showToast("La empresa es requerida para este rol.", "danger");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editing) {
        await updateUserRequest(accessToken, editing.id, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          username: form.username.trim().toLowerCase(),
          run: form.run.trim(),
          ...(form.password ? { password: form.password } : {}),
          businessId: form.businessId || null,
          roleId: form.roleId || null,
          locationId: form.locationId || null,
          areaId: form.areaId || null,
          state: form.state,
        });
        showToast("Usuario actualizado.", "success");
      } else {
        await createUserRequest(accessToken, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          username: form.username.trim().toLowerCase(),
          run: form.run.trim(),
          password: form.password,
          businessId: form.businessId || null,
          roleId: form.roleId || null,
          locationId: form.locationId || null,
          areaId: form.areaId || null,
          state: form.state,
        });
        showToast("Usuario creado. Se envió correo de confirmación.", "success");
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

  async function onDelete(row: AdminUser) {
    if (!accessToken) return;
    setMenuId(null);
    if (row.id === user?.id) {
      showToast("No puedes eliminar tu propia cuenta.", "danger");
      return;
    }
    const ok = window.confirm(
      `¿Eliminar a «${fullName(row)}»? Quedará desactivado.`,
    );
    if (!ok) return;
    try {
      await deleteUserRequest(accessToken, row.id);
      showToast("Usuario eliminado.", "success");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar.",
        "danger",
      );
    }
  }

  async function onUnlock(row: AdminUser) {
    if (!accessToken) return;
    setMenuId(null);
    try {
      await unlockUserRequest(accessToken, row.id);
      showToast("Usuario desbloqueado.", "success");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo desbloquear.",
        "danger",
      );
    }
  }

  const selectClass =
    "h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-nachipa-primary)]";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f9fafc]">
      <Topbar
        breadcrumb="Usuarios"
        breadcrumbIcon={Users}
        actions={<UserMenu />}
      />

      <div className="animate-enter flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden pb-6 pl-8 pr-12 pt-7">
        <PageHeader
          crumbs={[{ label: "Configuración" }, { label: "Usuarios" }]}
          title="Usuarios"
          description={
            isSuperadmin
              ? "Administra las cuentas del portal y sus roles."
              : "Administra los usuarios de tu empresa."
          }
          actions={
            <Button type="button" className="!w-auto shrink-0" onClick={openCreate}>
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
              Nuevo usuario
            </Button>
          }
        />

        <label className="flex h-11 w-full max-w-[448px] shrink-0 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white pl-4 pr-3.5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, RUN…"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--color-nachipa-placeholder)]"
          />
          <Search
            className="size-4 shrink-0 text-[var(--color-icon-default)]"
            strokeWidth={1.5}
            aria-hidden
          />
        </label>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--color-tremor-border)] bg-white">
          <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-[12px]">
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-semibold text-[var(--color-table-head-text,#6b6b73)]">
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Persona
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Email
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    RUN
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Rol
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Empresa
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Estado
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                    >
                      No hay usuarios para mostrar.
                    </td>
                  </tr>
                ) : null}
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-nachipa-border-subtle)]"
                  >
                    <td className="h-[52px] truncate px-3">
                      <div className="font-medium text-[var(--color-nachipa-title)]">
                        {fullName(row)}
                      </div>
                      <div className="text-[11px] text-[var(--color-nachipa-secondary)]">
                        @{row.username}
                        {isLocked(row) ? " · bloqueado" : ""}
                        {!row.confirmed ? " · sin confirmar" : ""}
                      </div>
                    </td>
                    <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {row.email}
                    </td>
                    <td className="h-[52px] truncate px-3 tabular-nums text-[var(--color-nachipa-body)]">
                      {row.run}
                    </td>
                    <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {row.role?.name ?? row.internalRol}
                    </td>
                    <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {row.business?.name ?? "—"}
                    </td>
                    <td className="h-[52px] px-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium leading-4",
                          row.state
                            ? "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]"
                            : "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]",
                        ].join(" ")}
                      >
                        {row.state ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="relative h-[52px] px-3 text-right">
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
                        <div className="absolute right-3 top-11 z-10 min-w-[150px] rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                            onClick={() => openEdit(row)}
                          >
                            Editar
                          </button>
                          {isLocked(row) ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                              onClick={() => void onUnlock(row)}
                            >
                              Desbloquear
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-status-danger-fg)] hover:bg-[var(--color-status-danger-bg)]"
                            onClick={() => void onDelete(row)}
                          >
                            Eliminar
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex h-[68px] shrink-0 items-center gap-3 border-t border-[var(--color-nachipa-border-subtle)] bg-white px-4">
            <p className="min-w-0 flex-1 text-[12px] font-medium text-[var(--color-nachipa-title)]">
              {loading
                ? "Cargando…"
                : `Total usuarios: ${filtered.length}${
                    search.trim() ? ` (de ${total})` : ""
                  }`}
            </p>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        icon={Users}
        title={editing ? "Editar usuario" : "Nuevo usuario"}
        subtitle={
          editing
            ? "Actualizá datos, rol y asignación de empresa."
            : "Se enviará un correo para confirmar la cuenta."
        }
        onClose={closeModal}
        maxWidthClass="w-full max-w-[640px] sm:w-[640px]"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              form="usuario-form"
              className="h-10 rounded-[var(--radius-md)] px-4 text-[13px] font-medium text-[var(--color-nachipa-secondary)] hover:bg-[var(--color-nachipa-bg-page)]"
              onClick={closeModal}
              disabled={submitting}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="usuario-form"
              className="!w-auto"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        }
      >
        <form id="usuario-form" className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Nombre"
              value={form.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              required
            />
            <TextField
              label="Apellido"
              value={form.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              required
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              required
            />
            <TextField
              label="Usuario"
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
              required
            />
            <TextField
              label="RUN"
              value={form.run}
              onChange={(e) => setField("run", e.target.value)}
              required
            />
            <TextField
              label={editing ? "Nueva contraseña (opcional)" : "Contraseña"}
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              required={!editing}
              autoComplete="new-password"
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[var(--color-nachipa-title)]">
              Rol
            </span>
            <select
              className={selectClass}
              value={form.roleId}
              onChange={(e) => setField("roleId", e.target.value)}
            >
              <option value="">Sin rol RBAC</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          {isSuperadmin ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-[var(--color-nachipa-title)]">
                Empresa
              </span>
              <select
                className={selectClass}
                value={form.businessId}
                onChange={(e) => setField("businessId", e.target.value)}
              >
                <option value="">Sin empresa</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-[var(--color-nachipa-title)]">
                Lugar de trabajo
              </span>
              <select
                className={selectClass}
                value={form.locationId}
                onChange={(e) => setField("locationId", e.target.value)}
              >
                <option value="">Sin lugar</option>
                {locationsForForm.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-[var(--color-nachipa-title)]">
                Área
              </span>
              <select
                className={selectClass}
                value={form.areaId}
                onChange={(e) => setField("areaId", e.target.value)}
              >
                <option value="">Sin área</option>
                {areasForForm.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3 py-2.5">
            <span className="text-[13px] text-[var(--color-nachipa-title)]">
              Activo
            </span>
            <Toggle
              checked={form.state}
              onChange={(v) => setField("state", v)}
              aria-label="Estado activo"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
