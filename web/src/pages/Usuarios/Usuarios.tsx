import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  CircleHelp,
  MoreVertical,
  Plus,
  Search,
  Users,
} from "lucide-react";

import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { TextField } from "../../components/TextField/TextField";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { forgotPasswordRequest } from "../../lib/api/auth";
import { listAreasRequest, type Area } from "../../lib/api/areas";
import { listBusinessesRequest, type Business } from "../../lib/api/businesses";
import { listLocationsRequest, type Location } from "../../lib/api/locations";
import { listRolesRequest, type Role } from "../../lib/api/roles";
import {
  createUserRequest,
  listUsersRequest,
  unlockUserRequest,
  updateUserRequest,
  type AdminUser,
} from "../../lib/api/users";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Form de invitar, editar datos o cambiar rol. */
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

/** Qué diálogo está abierto. null = ninguno. */
type DialogKind = "invite" | "edit" | "role";

/** Estado visible en la columna Estado (Figma S7). */
type UserStatus = "active" | "invited" | "disabled";

/** Orden de la columna Usuario. null = orden de la API. */
type NameSort = "asc" | "desc" | null;

/** Form vacío al invitar. */
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

/** Ventana en la que el último acceso se muestra como "Ahora". */
const NOW_WINDOW_MS = 5 * 60_000;
/** Un día, para "Ayer" y "Hace N días". */
const DAY_MS = 24 * 60 * 60_000;

/**
 * Paleta de avatares de S7 (rosa, verde, índigo, teal).
 * Se elige por el id para que cada persona conserve el color.
 */
const AVATAR_TONES = [
  { bg: "var(--color-kpi-rose-soft, #ffe4e6)", fg: "var(--color-kpi-rose, #f43f5e)" },
  { bg: "var(--color-status-success-bg)", fg: "var(--color-status-success-fg)" },
  { bg: "var(--color-kpi-indigo-soft)", fg: "var(--color-kpi-indigo)" },
  { bg: "var(--color-kpi-teal-soft, #dff7fb)", fg: "var(--color-kpi-teal, #06b6d4)" },
] as const;

/** Tooltip del menú cuando la fila es el único Superadmin activo. */
const LAST_SUPERADMIN_HINT =
  "Debe existir al menos un Superadmin activo. Promueve a otro usuario antes de cambiar este.";

/** Capitaliza cada palabra para la tabla (los nombres vienen en minúsculas). */
function displayName(value: string): string {
  if (!value) return "";
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Nombre completo para tabla y toasts. */
function fullName(row: AdminUser): string {
  const name = displayName(`${row.firstName} ${row.lastName}`.trim());
  return name || "—";
}

/** Iniciales del avatar (nombre + apellido). */
function initialsOf(row: AdminUser): string {
  const first = row.firstName.trim().charAt(0);
  const last = row.lastName.trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  return initials || "—";
}

/** Color estable del avatar a partir del id. */
function avatarTone(id: string): (typeof AVATAR_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i)) % AVATAR_TONES.length;
  }
  return AVATAR_TONES[hash] ?? AVATAR_TONES[0];
}

/** True si lockUntil está en el futuro. */
function isLocked(row: AdminUser): boolean {
  if (!row.lockUntil) return false;
  return new Date(row.lockUntil).getTime() > Date.now();
}

/** Superadmin de sistema (rol RBAC o internalRol legado). */
function isSystemSuperadmin(row: AdminUser): boolean {
  return row.internalRol === "superadmin" || row.role?.key === "superadmin";
}

/** Etiqueta de rol: nombre del catálogo, o el internalRol si no hay rol. */
function roleLabel(row: AdminUser): string {
  if (row.role?.name) return row.role.name;
  if (row.internalRol === "superadmin") return "Superadmin";
  if (row.internalRol === "admin") return "Administrador";
  return "Usuario";
}

/** Alcance: todo el sistema si es Superadmin sin empresa; si no, la empresa. */
function scopeLabel(row: AdminUser): string {
  if (isSystemSuperadmin(row) && !row.business) return "Todo el sistema";
  return row.business?.name ? displayName(row.business.name) : "—";
}

/** Estado de la fila: desactivado gana sobre invitado. */
function userStatus(row: AdminUser): UserStatus {
  if (!row.state) return "disabled";
  if (!row.confirmed) return "invited";
  return "active";
}

/** Chip de estado (colores Figma StatusChip). */
function statusChip(status: UserStatus): { label: string; className: string } {
  if (status === "disabled") {
    return {
      label: "Desactivado",
      className:
        "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral-fg)]",
    };
  }
  if (status === "invited") {
    return {
      label: "Invitado",
      className:
        "bg-[var(--color-status-info-bg)] text-[var(--color-status-info-fg)]",
    };
  }
  return {
    label: "Activo",
    className:
      "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]",
  };
}

/** Fecha corta DD-MM-AAAA, como la fila desactivada de S7. */
function formatShortDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

/** Texto de último acceso: relativo si está activo, fecha si está desactivado. */
function lastAccessLabel(row: AdminUser): string {
  if (!row.confirmed) {
    const created = new Date(row.createdAt).getTime();
    const days = Math.floor((Date.now() - created) / DAY_MS);
    if (days <= 0) return "Invitado hoy";
    if (days === 1) return "Invitado ayer";
    return `Invitado hace ${days} días`;
  }
  if (!row.lastLoginAt) return "—";
  if (!row.state) return formatShortDate(row.lastLoginAt);
  const elapsed = Date.now() - new Date(row.lastLoginAt).getTime();
  if (elapsed < NOW_WINDOW_MS) return "Ahora";
  if (elapsed < 60 * 60_000) {
    const minutes = Math.max(1, Math.floor(elapsed / 60_000));
    return `Hace ${minutes} min`;
  }
  if (elapsed < DAY_MS) {
    const hours = Math.max(1, Math.floor(elapsed / 3_600_000));
    return `Hace ${hours} h`;
  }
  const days = Math.floor(elapsed / DAY_MS);
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return formatShortDate(row.lastLoginAt);
}

/**
 * Pantalla Usuarios (Figma S7 · 243:20346).
 * Lista del sistema, invitación y menú que protege al último Superadmin.
 */
export function Usuarios() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";

  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [nameSort, setNameSort] = useState<NameSort>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  /** Posición fija del menú para que no lo recorte la tabla. */
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );

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

  /** Catálogos para los selects de invitar y cambiar rol. */
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

  /** Cierra el menú si se hace click fuera o se scrollea. */
  useEffect(() => {
    if (!menuId) return;
    function close() {
      setMenuId(null);
      setMenuPos(null);
    }
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [menuId]);

  /** Superadmins activos: si queda uno, su rol y su baja quedan bloqueados. */
  const activeSuperadminCount = useMemo(
    () => items.filter((row) => row.state && isSystemSuperadmin(row)).length,
    [items],
  );

  /** True si esta fila es el único Superadmin que sigue activo. */
  function isLastSuperadmin(row: AdminUser): boolean {
    return row.state && isSystemSuperadmin(row) && activeSuperadminCount <= 1;
  }

  const roleOptions = useMemo(() => {
    const labels = new Set(items.map((row) => roleLabel(row)));
    return [...labels].sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = items.filter((row) => {
      if (roleFilter !== "all" && roleLabel(row) !== roleFilter) return false;
      if (statusFilter !== "all" && userStatus(row) !== statusFilter) return false;
      if (!q) return true;
      return [fullName(row), row.email, roleLabel(row), scopeLabel(row)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    if (nameSort) {
      rows = [...rows].sort((a, b) => {
        const cmp = fullName(a).localeCompare(fullName(b), "es");
        return nameSort === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [items, search, roleFilter, statusFilter, nameSort]);

  /** Locations filtradas por empresa del form. */
  const locationsForForm = useMemo(() => {
    if (!form.businessId) return locations;
    return locations.filter((location) => location.businessId === form.businessId);
  }, [locations, form.businessId]);

  /** Áreas filtradas por location del form. */
  const areasForForm = useMemo(() => {
    if (!form.locationId) return areas;
    return areas.filter((area) => area.locationId === form.locationId);
  }, [areas, form.locationId]);

  function formFromRow(row: AdminUser): FormState {
    return {
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
    };
  }

  function openInvite() {
    setEditing(null);
    setMenuId(null);
    setForm({
      ...EMPTY_FORM,
      businessId: isSuperadmin ? "" : (user?.businessId ?? ""),
    });
    setDialog("invite");
  }

  function openEdit(row: AdminUser) {
    setEditing(row);
    setMenuId(null);
    setForm(formFromRow(row));
    setDialog("edit");
  }

  function openRole(row: AdminUser) {
    if (isLastSuperadmin(row)) return;
    setEditing(row);
    setMenuId(null);
    setForm(formFromRow(row));
    setDialog("role");
  }

  function closeDialog() {
    setDialog(null);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Cascada: cambiar empresa limpia lugar y área.
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

  function toggleMenu(rowId: string, event: MouseEvent<HTMLButtonElement>) {
    if (menuId === rowId) {
      setMenuId(null);
      setMenuPos(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuId(rowId);
    setMenuPos({
      top: rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }

  function toggleNameSort() {
    setNameSort((current) => {
      if (current === null) return "asc";
      if (current === "asc") return "desc";
      return null;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !dialog) return;

    if (dialog !== "role") {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        showToast("Nombre y apellido son requeridos.", "danger");
        return;
      }
      if (!form.email.trim()) {
        showToast("El correo es requerido.", "danger");
        return;
      }
    }

    if (dialog === "invite") {
      if (!form.username.trim() || !form.run.trim()) {
        showToast("Usuario y RUN son requeridos.", "danger");
        return;
      }
      if (form.password.length < 8) {
        showToast("La contraseña debe tener al menos 8 caracteres.", "danger");
        return;
      }
    }

    const selectedRole = roles.find((role) => role.id === form.roleId);
    if (
      isSuperadmin &&
      dialog !== "edit" &&
      selectedRole &&
      selectedRole.key !== "superadmin" &&
      !form.businessId
    ) {
      showToast("La empresa es requerida para este rol.", "danger");
      return;
    }

    setSubmitting(true);
    try {
      if (dialog === "invite") {
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
          state: true,
        });
        showToast("Invitación enviada. Falta que confirme el correo.", "success");
      } else if (dialog === "edit" && editing) {
        await updateUserRequest(accessToken, editing.id, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
        });
        showToast("Datos actualizados.", "success");
      } else if (dialog === "role" && editing) {
        if (isLastSuperadmin(editing)) {
          showToast(LAST_SUPERADMIN_HINT, "danger");
          return;
        }
        await updateUserRequest(accessToken, editing.id, {
          roleId: form.roleId || null,
          businessId: form.businessId || null,
          locationId: form.locationId || null,
          areaId: form.areaId || null,
        });
        showToast("Rol actualizado.", "success");
      }
      closeDialog();
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

  async function onResetPassword(row: AdminUser) {
    setMenuId(null);
    try {
      await forgotPasswordRequest(row.email);
      showToast("Enviamos un enlace para restablecer la contraseña.", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo enviar el enlace.",
        "danger",
      );
    }
  }

  async function onToggleActive(row: AdminUser) {
    if (!accessToken) return;
    setMenuId(null);
    if (isLastSuperadmin(row)) {
      showToast(LAST_SUPERADMIN_HINT, "danger");
      return;
    }
    if (row.id === user?.id && row.state) {
      showToast("No puedes desactivar tu propia cuenta.", "danger");
      return;
    }
    try {
      await updateUserRequest(accessToken, row.id, { state: !row.state });
      showToast(
        row.state ? "Usuario desactivado." : "Usuario activado.",
        "success",
      );
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cambiar el estado.",
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

  const menuRow = menuId ? items.find((row) => row.id === menuId) : undefined;
  const menuLocked = menuRow ? isLastSuperadmin(menuRow) : false;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f9fafc]">
      <Topbar
        breadcrumb="Sistema / Usuarios"
        breadcrumbIcon={Users}
        actions={<UserMenu />}
      />

      <div className="animate-enter flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-auto px-8 pb-8 pt-7">
        <div className="flex shrink-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-semibold leading-[26px] text-[var(--color-nachipa-title)]">
              Usuarios del sistema
            </h1>
            <p className="mt-1 text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
              {isSuperadmin
                ? "Todas las empresas. Siempre debe existir al menos un Superadmin activo."
                : "Usuarios de tu empresa. Desactiva en vez de eliminar."}
            </p>
          </div>
          <Button type="button" className="!w-auto shrink-0 !font-medium" onClick={openInvite}>
            <Plus className="size-4" strokeWidth={1.5} aria-hidden />
            Invitar usuario
          </Button>
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 rounded-[14px] border border-[var(--color-tremor-border)] bg-white p-3">
          <div className="flex gap-2">
            <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white pl-3 pr-2.5">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nombre o correo…"
                className="min-w-0 flex-1 bg-transparent text-[12px] leading-[18px] text-[var(--color-nachipa-title)] outline-none placeholder:text-[var(--color-nachipa-placeholder)]"
              />
              <Search
                className="size-3.5 shrink-0 text-[var(--color-icon-default)]"
                strokeWidth={1.5}
                aria-hidden
              />
            </label>
            <select
              className="h-8 w-[240px] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[12px] text-[var(--color-nachipa-body)] outline-none"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              aria-label="Filtrar por rol"
            >
              <option value="all">Rol: todos</option>
              {roleOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="h-8 w-[240px] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[12px] text-[var(--color-nachipa-body)] outline-none"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | UserStatus)
              }
              aria-label="Filtrar por estado"
            >
              <option value="all">Estado: todos</option>
              <option value="active">Activo</option>
              <option value="invited">Invitado</option>
              <option value="disabled">Desactivado</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1094px] border-collapse text-left">
              <colgroup>
                <col style={{ width: "330px" }} />
                <col style={{ width: "170px" }} />
                <col style={{ width: "180px" }} />
                <col style={{ width: "180px" }} />
                <col style={{ width: "190px" }} />
                <col style={{ width: "44px" }} />
              </colgroup>
              <thead>
                <tr className="text-[12px] font-semibold leading-[18px] text-[var(--color-table-head-text)]">
                  <th className="h-9 rounded-l-lg border-b border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg)] px-3 text-left">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5"
                      onClick={toggleNameSort}
                    >
                      Usuario
                      {nameSort === "asc" ? (
                        <ChevronUp className="size-3" strokeWidth={1.5} aria-hidden />
                      ) : nameSort === "desc" ? (
                        <ChevronDown className="size-3" strokeWidth={1.5} aria-hidden />
                      ) : (
                        <ChevronsUpDown className="size-3" strokeWidth={1.5} aria-hidden />
                      )}
                    </button>
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg)] px-3 font-semibold">
                    Rol
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg)] px-3 font-semibold">
                    Alcance
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg)] px-3 font-semibold">
                    Estado
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg)] px-3 font-semibold">
                    Último acceso
                  </th>
                  <th className="h-9 rounded-r-lg border-b border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg)] px-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : null}
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                    >
                      No hay usuarios para mostrar.
                    </td>
                  </tr>
                ) : null}
                {!loading
                  ? filtered.map((row) => {
                  const status = userStatus(row);
                  const chip = statusChip(status);
                  const tone = avatarTone(row.id);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--color-tremor-border)] last:border-b-0"
                    >
                      <td className="h-14 px-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-[18px] text-[12px] font-semibold"
                            style={{ background: tone.bg, color: tone.fg }}
                          >
                            {initialsOf(row)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-medium leading-[18px] text-[var(--color-nachipa-title)]">
                              {fullName(row)}
                            </span>
                            <span className="block truncate text-[12px] leading-[17px] text-[var(--color-nachipa-secondary)]">
                              {row.email}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="h-14 truncate px-3 text-[13px] text-[var(--color-nachipa-body)]">
                        {roleLabel(row)}
                      </td>
                      <td className="h-14 truncate px-3 text-[13px] text-[var(--color-nachipa-body)]">
                        {scopeLabel(row)}
                      </td>
                      <td className="h-14 px-3">
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium leading-4",
                            chip.className,
                          ].join(" ")}
                        >
                          {chip.label}
                        </span>
                      </td>
                      <td
                        className={[
                          "h-14 truncate px-3 text-[13px] text-[var(--color-nachipa-secondary)]",
                          status === "disabled" ? "opacity-55" : "",
                        ].join(" ")}
                      >
                        {lastAccessLabel(row)}
                      </td>
                      <td className="h-14 px-1 text-right">
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-icon-default)] hover:bg-[var(--color-nachipa-bg-page)]"
                          aria-label={`Acciones de ${fullName(row)}`}
                          aria-expanded={menuId === row.id}
                          onClick={(event) => toggleMenu(row.id, event)}
                        >
                          <MoreVertical
                            className="size-[18px]"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })
                  : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-[10px] bg-[var(--color-table-head-bg)] px-3.5 py-3">
          <CircleHelp
            className="size-4 shrink-0 text-[var(--color-nachipa-secondary)]"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
            Desactiva en vez de eliminar
          </p>
          <p className="text-[13px] text-[var(--color-nachipa-secondary)]">
            · La persona conserva su historial, sus cursos y su bitácora, y deja de tener acceso.
          </p>
        </div>
      </div>

      {menuId ? (
        <button
          type="button"
          className="fixed inset-0 z-20 cursor-default"
          aria-label="Cerrar menú"
          onClick={() => {
            setMenuId(null);
            setMenuPos(null);
          }}
        />
      ) : null}
      {menuRow && menuPos ? (
        <div
          className="fixed z-30 w-[260px] rounded-[10px] border border-[var(--color-tremor-border)] bg-white p-1.5 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.12)]"
          style={{ top: menuPos.top, right: menuPos.right }}
          role="menu"
        >
          <MenuItem
            title="Editar datos"
            hint="Nombre y correo"
            onClick={() => openEdit(menuRow)}
          />
          <MenuItem
            title="Restablecer contraseña"
            hint="Envía un link por correo"
            onClick={() => void onResetPassword(menuRow)}
          />
          {isLocked(menuRow) ? (
            <MenuItem
              title="Desbloquear"
              hint="Limpia el bloqueo por intentos"
              onClick={() => void onUnlock(menuRow)}
            />
          ) : null}
          <MenuItem
            title="Cambiar rol"
            hint={menuLocked ? "Único Superadmin activo" : roleLabel(menuRow)}
            disabled={menuLocked}
            disabledReason={LAST_SUPERADMIN_HINT}
            onClick={() => openRole(menuRow)}
          />
          <MenuItem
            title={menuRow.state ? "Desactivar usuario" : "Activar usuario"}
            hint={
              menuLocked
                ? "Único Superadmin activo"
                : menuRow.state
                  ? "Deja de tener acceso"
                  : "Vuelve a tener acceso"
            }
            disabled={menuLocked}
            disabledReason={LAST_SUPERADMIN_HINT}
            onClick={() => void onToggleActive(menuRow)}
          />
        </div>
      ) : null}

      <Modal
        open={dialog !== null}
        icon={Users}
        title={
          dialog === "role"
            ? "Cambiar rol"
            : dialog === "edit"
              ? "Editar datos"
              : "Invitar usuario"
        }
        subtitle={
          dialog === "role"
            ? "El alcance sigue a la empresa. Un Superadmin sin empresa ve todo el sistema."
            : dialog === "edit"
              ? "Nombre y correo. El rol se cambia aparte."
              : "Se enviará un correo para confirmar la cuenta."
        }
        onClose={closeDialog}
        maxWidthClass={
          dialog === "invite"
            ? "w-full max-w-[640px] sm:w-[640px]"
            : "w-full max-w-[520px] sm:w-[520px]"
        }
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
              onClick={closeDialog}
              disabled={submitting}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="usuario-form"
              className="!w-auto !font-medium"
              disabled={submitting}
            >
              {submitting
                ? "Guardando…"
                : dialog === "invite"
                  ? "Invitar"
                  : "Guardar"}
            </Button>
          </div>
        }
      >
        <form id="usuario-form" className="flex flex-col gap-4" onSubmit={onSubmit}>
          {dialog !== "role" ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Nombre"
                  value={form.firstName}
                  onChange={(event) => setField("firstName", event.target.value)}
                  required
                />
                <TextField
                  label="Apellido"
                  value={form.lastName}
                  onChange={(event) => setField("lastName", event.target.value)}
                  required
                />
              </div>
              <TextField
                label="Correo"
                type="email"
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
                required
              />
            </>
          ) : null}

          {dialog === "invite" ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Usuario"
                  value={form.username}
                  onChange={(event) => setField("username", event.target.value)}
                  required
                />
                <TextField
                  label="RUN"
                  value={form.run}
                  onChange={(event) => setField("run", event.target.value)}
                  required
                />
              </div>
              <TextField
                label="Contraseña"
                type="password"
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
                required
                autoComplete="new-password"
              />
              <RoleFields
                form={form}
                roles={roles}
                businesses={businesses}
                locations={locationsForForm}
                areas={areasForForm}
                isSuperadmin={isSuperadmin}
                selectClass={selectClass}
                onChange={setField}
              />
            </>
          ) : null}

          {dialog === "role" ? (
            <RoleFields
              form={form}
              roles={roles}
              businesses={businesses}
              locations={locationsForForm}
              areas={areasForForm}
              isSuperadmin={isSuperadmin}
              selectClass={selectClass}
              onChange={setField}
            />
          ) : null}
        </form>
      </Modal>
    </div>
  );
}

/** Ítem del menú de fila: título + pista. Si está disabled, muestra el tooltip. */
function MenuItem({
  title,
  hint,
  disabled = false,
  disabledReason,
  onClick,
}: {
  title: string;
  hint: string;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={[
        "group relative flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "hover:bg-[var(--color-nachipa-bg-page)]",
      ].join(" ")}
      onClick={onClick}
    >
      <span className="text-[13px] font-medium leading-[19px] text-[var(--color-nachipa-title)]">
        {title}
      </span>
      <span className="text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
        {hint}
      </span>
      {disabled && disabledReason ? (
        <span className="pointer-events-none absolute right-full top-1/2 z-10 mr-2 hidden w-[271px] -translate-y-1/2 rounded-lg bg-[var(--color-nachipa-title)] px-3 py-2.5 text-[12px] font-normal leading-[17px] text-white shadow-lg group-hover:block">
          {disabledReason}
        </span>
      ) : null}
    </button>
  );
}

/** Selects de rol, empresa, lugar y área (invitar y cambiar rol). */
function RoleFields({
  form,
  roles,
  businesses,
  locations,
  areas,
  isSuperadmin,
  selectClass,
  onChange,
}: {
  form: FormState;
  roles: Role[];
  businesses: Business[];
  locations: Location[];
  areas: Area[];
  isSuperadmin: boolean;
  selectClass: string;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-[var(--color-nachipa-title)]">
          Rol
        </span>
        <select
          className={selectClass}
          value={form.roleId}
          onChange={(event) => onChange("roleId", event.target.value)}
        >
          <option value="">Sin rol</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
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
            onChange={(event) => onChange("businessId", event.target.value)}
          >
            <option value="">Sin empresa · todo el sistema</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {displayName(business.name)}
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
            onChange={(event) => onChange("locationId", event.target.value)}
          >
            <option value="">Sin lugar</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {displayName(location.name)}
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
            onChange={(event) => onChange("areaId", event.target.value)}
          >
            <option value="">Sin área</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {displayName(area.name)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
