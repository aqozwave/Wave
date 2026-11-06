import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Building2, ClipboardCheck, Pencil, Plus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
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
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import { downloadXls } from "../../lib/exportXls";
import {
  createAccreditationRequest,
  listAccreditationsRequest,
  type AccreditationStatus,
  type ContractorAccreditation,
} from "../../lib/api/accreditations";
import {
  createContractorPersonRequest,
  deleteContractorPersonRequest,
  getContractorRequest,
  inviteContractorUserRequest,
  listContractorPeopleRequest,
  listContractorUsersRequest,
  updateContractorPersonRequest,
  updateContractorRequest,
  type ContractorOrganization,
  type ContractorPerson,
  type ContractorRole,
  type ContractorUser,
} from "../../lib/api/contractors";
import { userHasPermission } from "../../lib/api/auth";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Capitaliza nombre en minúsculas. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Iniciales avatar (P9c). */
function orgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Meta header P9c. */
function roleMeta(role: ContractorRole): string {
  return role === "permanent"
    ? "Contratista permanente"
    : "Contratista ocasional";
}

/** Rol corto en grilla Datos. */
function roleShort(role: ContractorRole): string {
  return role === "permanent" ? "Permanente" : "Ocasional";
}

/** Fecha dd-mm-yyyy. */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/** Chip “Habilitada desde …” si HAB aprobada. */
function habilitadaChip(org: ContractorOrganization): string | null {
  const hab = org.latestAccreditation;
  if (!hab || hab.status !== "approved") return null;
  const from = formatDate(
    hab.reviewedAt ?? hab.submittedAt ?? hab.requestedAt,
  );
  if (from === "—") return "Habilitada";
  return `Habilitada desde ${from}`;
}

/** Iniciales de usuario (celda Persona P9). */
function userInitials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  const s = `${a}${b}`.toUpperCase();
  return s || "?";
}

/** Rol visible en tabla Usuarios. */
function userRoleLabel(internalRol: string): string {
  if (!internalRol) return "—";
  if (internalRol === "contratista") return "Contratista";
  return displayName(internalRol.replace(/_/g, " "));
}

/** Último acceso relativo corto (hoy / ayer / fecha). */
function formatLastAccess(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86_400_000,
  );
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;
  if (diffDays === 0) return `hoy ${time}`;
  if (diffDays === 1) return `ayer ${time}`;
  return `${formatDate(iso)} ${time}`;
}

/** Filtro select compacto toolbar. */
const filterSelectClass =
  "h-8 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[12px] text-[var(--color-nachipa-body)] outline-none";

/** Filtro de estado en tab Usuarios (P9). */
type UserStatusFilter = "" | "active" | "invited" | "inactive";

/** Filtro estado tab Habilitación (vacío = todos). */
type HabStatusFilter = "" | AccreditationStatus;

/** Etiqueta estado HAB. */
function statusLabel(status: AccreditationStatus): string {
  switch (status) {
    case "invited":
      return "Invitada";
    case "pending":
      return "Pendiente";
    case "in_review":
      return "En revisión";
    case "observed":
      return "Observada";
    case "approved":
      return "Aprobada";
    case "rejected":
      return "Rechazada";
    default:
      return status;
  }
}

/** Tono chip HAB. */
function statusTone(
  status: AccreditationStatus,
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "approved":
      return "success";
    case "in_review":
      return "info";
    case "observed":
    case "pending":
    case "invited":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

/** Tabs P9c (+ Personal cableado; Permisos placeholder). */
type TabId =
  | "datos"
  | "usuarios"
  | "habilitaciones"
  | "personal"
  | "permisos";

/** Form alta/edición de persona. */
type PersonForm = {
  rut: string;
  fullName: string;
  position: string;
  email: string;
  phone: string;
  emergencyContact: string;
  active: boolean;
};

/** Form edición de datos (P9m). */
type EditForm = {
  name: string;
  role: ContractorRole;
  specialty: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  legalRepresentative: string;
  address: string;
  mutual: string;
  supervisorName: string;
  supervisorEmail: string;
  prevencionistName: string;
  prevencionistEmail: string;
  subcontractors: string;
  workDescription: string;
  active: boolean;
};

const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

const outlineBtnClass =
  "inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/** Formulario de invitación (P9b). */
type InviteForm = {
  email: string;
  firstName: string;
  lastName: string;
  run: string;
};

/**
 * Ficha de organización contratista (P2 · P9 / P9c / P9b).
 * Tabs: Datos · Habilitaciones · Usuarios (invitar).
 */
export function ContractorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const canRead = userHasPermission(user, "contractors", "read");
  const canInvite =
    (user?.internalRol === "admin" || user?.internalRol === "superadmin") &&
    userHasPermission(user, "contractors", "create");
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";
  const canCreatePeople =
    canManage && userHasPermission(user, "contractors", "create");
  const canUpdatePeople =
    canManage && userHasPermission(user, "contractors", "update");
  const canDeactivatePeople =
    canManage && userHasPermission(user, "contractors", "deactivate");
  const canReadHab = userHasPermission(user, "accreditations", "read");
  const canCreateHab = userHasPermission(user, "accreditations", "create");

  const [org, setOrg] = useState<ContractorOrganization | null>(null);
  const [habs, setHabs] = useState<ContractorAccreditation[]>([]);
  const [orgUsers, setOrgUsers] = useState<ContractorUser[]>([]);
  const [people, setPeople] = useState<ContractorPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("datos");

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: "",
    firstName: "",
    lastName: "",
    run: "",
  });
  const [inviting, setInviting] = useState(false);

  const [personOpen, setPersonOpen] = useState(false);
  const [personEditing, setPersonEditing] = useState<ContractorPerson | null>(
    null,
  );
  const [personForm, setPersonForm] = useState<PersonForm>({
    rut: "",
    fullName: "",
    position: "",
    email: "",
    phone: "",
    emergencyContact: "",
    active: true,
  });
  const [personSaving, setPersonSaving] = useState(false);
  const [pendingDeactivatePerson, setPendingDeactivatePerson] =
    useState<ContractorPerson | null>(null);

  /** Toolbar tab Usuarios (P9). */
  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] =
    useState<UserStatusFilter>("");

  /** Toolbar tab Habilitación (DataTable como Usuarios / bandeja). */
  const [habSearch, setHabSearch] = useState("");
  const [habStatusFilter, setHabStatusFilter] = useState<HabStatusFilter>("");
  const [habRequestOpen, setHabRequestOpen] = useState(false);
  const [habMessage, setHabMessage] = useState(
    "Favor subir la documentación del pack empresa para habilitación.",
  );
  const [habRequesting, setHabRequesting] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return orgUsers.filter((u) => {
      if (userStatusFilter === "active" && (!u.state || u.invitePending)) {
        return false;
      }
      if (userStatusFilter === "invited" && !u.invitePending) return false;
      if (userStatusFilter === "inactive" && u.state) return false;
      if (!q) return true;
      const hay = `${u.firstName} ${u.lastName} ${u.email} ${u.run}`.toLowerCase();
      return hay.includes(q);
    });
  }, [orgUsers, userSearch, userStatusFilter]);

  const {
    pageItems: userPageItems,
    page: userPage,
    setPage: setUserPage,
    pageSize: userPageSize,
    setPageSize: setUserPageSize,
    pageCount: userPageCount,
    total: userTotal,
  } = useClientTablePagination(filteredUsers);

  const filteredHabs = useMemo(() => {
    const q = habSearch.trim().toLowerCase();
    return habs.filter((h) => {
      if (habStatusFilter && h.status !== habStatusFilter) return false;
      if (!q) return true;
      const hay = `${h.code} ${h.message ?? ""} ${h.reviewNote ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [habs, habSearch, habStatusFilter]);

  const {
    pageItems: habPageItems,
    page: habPage,
    setPage: setHabPage,
    pageSize: habPageSize,
    setPageSize: setHabPageSize,
    pageCount: habPageCount,
    total: habTotal,
  } = useClientTablePagination(filteredHabs);

  /** Exporta XLS del listado filtrado de usuarios. */
  function onExportUsers() {
    if (filteredUsers.length === 0) {
      showToast("No hay filas para exportar.", "info");
      return;
    }
    downloadXls(
      filteredUsers,
      [
        {
          header: "Usuario",
          value: (u) => displayName(`${u.firstName} ${u.lastName}`),
        },
        { header: "RUN", value: (u) => u.run },
        { header: "Correo", value: (u) => u.email },
        { header: "Rol", value: (u) => userRoleLabel(u.internalRol) },
        {
          header: "Último acceso",
          value: (u) => formatLastAccess(u.lastLoginAt),
        },
        {
          header: "Invitado por",
          value: (u) =>
            u.invitedBy
              ? displayName(
                  `${u.invitedBy.firstName} ${u.invitedBy.lastName}`,
                )
              : "",
        },
        {
          header: "Estado",
          value: (u) =>
            !u.state ? "Inactivo" : u.invitePending ? "Invitado" : "Activo",
        },
      ],
      `usuarios-${org?.rut ?? "org"}`,
    );
  }

  /** Abre modal solicitar documentación (org de la ficha). */
  function openHabRequest() {
    setHabMessage(
      "Favor subir la documentación del pack empresa para habilitación.",
    );
    setHabRequestOpen(true);
  }

  /** POST /accreditations para esta organización. */
  async function onRequestHab(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !org || habRequesting || !canCreateHab) return;
    setHabRequesting(true);
    try {
      await createAccreditationRequest(accessToken, {
        organizationId: org.id,
        message: habMessage.trim() || null,
        dueAt: null,
      });
      showToast("Solicitud de documentación creada.", "success");
      setHabRequestOpen(false);
      setTab("habilitaciones");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo solicitar.",
        "danger",
      );
    } finally {
      setHabRequesting(false);
    }
  }

  /** Exporta HABs filtradas de la ficha. */
  function onExportHabs() {
    if (filteredHabs.length === 0) {
      showToast("No hay filas para exportar.", "info");
      return;
    }
    downloadXls(
      filteredHabs,
      [
        { header: "Código", value: (h) => h.code },
        { header: "Estado", value: (h) => statusLabel(h.status) },
        {
          header: "Solicitada",
          value: (h) => formatDate(h.requestedAt),
        },
        { header: "Plazo", value: (h) => formatDate(h.dueAt) },
        { header: "Mensaje", value: (h) => h.message ?? "" },
      ],
      `habilitaciones-${org?.rut ?? "org"}`,
    );
  }

  const load = useCallback(async () => {
    if (!accessToken || !id || !canRead) return;
    setLoading(true);
    try {
      const row = await getContractorRequest(accessToken, id);
      setOrg(row);
      if (canReadHab) {
        const habList = await listAccreditationsRequest(accessToken, 1, 50, {
          organizationId: id,
        });
        setHabs(habList.items);
      } else {
        setHabs([]);
      }
      const usersList = await listContractorUsersRequest(accessToken, id, 1, 50);
      setOrgUsers(usersList.items);
      const peopleList = await listContractorPeopleRequest(
        accessToken,
        id,
        1,
        100,
      );
      setPeople(peopleList.items);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cargar la organización",
        "danger",
      );
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, canRead, canReadHab, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Abre modal editar datos. */
  function openEdit() {
    if (!org) return;
    setForm({
      name: displayName(org.name),
      role: org.role,
      specialty: org.specialty ?? "",
      contactName: org.contactName ?? "",
      contactEmail: org.contactEmail ?? "",
      contactPhone: org.contactPhone ?? "",
      legalRepresentative: org.legalRepresentative ?? "",
      address: org.address ?? "",
      mutual: org.mutual ?? "",
      supervisorName: org.supervisorName ?? "",
      supervisorEmail: org.supervisorEmail ?? "",
      prevencionistName: org.prevencionistName ?? "",
      prevencionistEmail: org.prevencionistEmail ?? "",
      subcontractors: org.subcontractors ?? "",
      workDescription: org.workDescription ?? "",
      active: org.active,
    });
    setEditOpen(true);
  }

  /** PATCH datos. */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !org || !form || submitting) return;
    if (!form.name.trim()) {
      showToast("El nombre es requerido.", "danger");
      return;
    }
    setSubmitting(true);
    try {
      await updateContractorRequest(accessToken, org.id, {
        name: form.name.trim(),
        role: form.role,
        specialty: form.specialty.trim() || null,
        contactName: form.contactName.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        legalRepresentative: form.legalRepresentative.trim() || null,
        address: form.address.trim() || null,
        mutual: form.mutual.trim() || null,
        supervisorName: form.supervisorName.trim() || null,
        supervisorEmail: form.supervisorEmail.trim() || null,
        prevencionistName: form.prevencionistName.trim() || null,
        prevencionistEmail: form.prevencionistEmail.trim() || null,
        subcontractors: form.subcontractors.trim() || null,
        workDescription: form.workDescription.trim() || null,
        active: form.active,
      });
      showToast("Datos actualizados.", "success");
      setEditOpen(false);
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

  /** Abre modal invitar usuario (P9b). */
  function openInvite() {
    setInviteForm({ email: "", firstName: "", lastName: "", run: "" });
    setInviteOpen(true);
  }

  /** POST invitación. */
  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !org || inviting) return;
    if (
      !inviteForm.email.trim() ||
      !inviteForm.firstName.trim() ||
      !inviteForm.lastName.trim() ||
      !inviteForm.run.trim()
    ) {
      showToast("Completá email, nombre, apellido y RUN.", "danger");
      return;
    }
    setInviting(true);
    try {
      await inviteContractorUserRequest(accessToken, org.id, {
        email: inviteForm.email.trim().toLowerCase(),
        firstName: inviteForm.firstName.trim(),
        lastName: inviteForm.lastName.trim(),
        run: inviteForm.run.trim(),
      });
      showToast("Invitación enviada.", "success");
      setInviteOpen(false);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo invitar.",
        "danger",
      );
    } finally {
      setInviting(false);
    }
  }

  /** Abre modal alta persona. */
  function openCreatePerson() {
    setPersonEditing(null);
    setPersonForm({
      rut: "",
      fullName: "",
      position: "",
      email: "",
      phone: "",
      emergencyContact: "",
      active: true,
    });
    setPersonOpen(true);
  }

  /** Abre modal editar persona. */
  function openEditPerson(row: ContractorPerson) {
    setPersonEditing(row);
    setPersonForm({
      rut: row.rut,
      fullName: displayName(row.fullName),
      position: row.position ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      emergencyContact: row.emergencyContact ?? "",
      active: row.active,
    });
    setPersonOpen(true);
  }

  /** POST/PATCH persona. */
  async function onSavePerson(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !org || personSaving) return;
    if (!personForm.fullName.trim() || !personForm.rut.trim()) {
      showToast("Nombre y RUN son requeridos.", "danger");
      return;
    }
    setPersonSaving(true);
    try {
      if (personEditing) {
        await updateContractorPersonRequest(accessToken, org.id, personEditing.id, {
          rut: personForm.rut.trim(),
          fullName: personForm.fullName.trim(),
          position: personForm.position.trim() || null,
          email: personForm.email.trim() || null,
          phone: personForm.phone.trim() || null,
          emergencyContact: personForm.emergencyContact.trim() || null,
          active: personForm.active,
        });
        showToast("Persona actualizada.", "success");
      } else {
        await createContractorPersonRequest(accessToken, org.id, {
          rut: personForm.rut.trim(),
          fullName: personForm.fullName.trim(),
          position: personForm.position.trim() || null,
          email: personForm.email.trim() || null,
          phone: personForm.phone.trim() || null,
          emergencyContact: personForm.emergencyContact.trim() || null,
          active: personForm.active,
        });
        showToast("Persona agregada.", "success");
      }
      setPersonOpen(false);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setPersonSaving(false);
    }
  }

  /** Soft delete persona. */
  async function confirmDeactivatePerson() {
    if (!accessToken || !org || !pendingDeactivatePerson) return;
    setPersonSaving(true);
    try {
      await deleteContractorPersonRequest(
        accessToken,
        org.id,
        pendingDeactivatePerson.id,
      );
      showToast("Persona desactivada.", "success");
      setPendingDeactivatePerson(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo desactivar.",
        "danger",
      );
    } finally {
      setPersonSaving(false);
    }
  }

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Prevención"
          breadcrumbIcon={Building2}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            No tenés permiso contractors.read.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Prevención"
          breadcrumbIcon={Building2}
          actions={<UserMenu />}
        />
        <p className="px-6 py-5 text-[13px] text-[var(--color-nachipa-secondary)]">
          Cargando…
        </p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Prevención"
          breadcrumbIcon={Building2}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Organización no encontrada.
          </p>
          <button
            type="button"
            className={`${outlineBtnClass} mt-3`}
            onClick={() => void navigate("/prevencion/contratistas")}
          >
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  const habChip = habilitadaChip(org);
  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "datos", label: "Datos" },
    { id: "usuarios", label: "Usuarios", count: orgUsers.length },
    { id: "habilitaciones", label: "Habilitación", count: habs.length },
    { id: "personal", label: "Personal", count: people.length },
    { id: "permisos", label: "Permisos de trabajo" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Prevención"
        breadcrumbIcon={Building2}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        {/* Breadcrumb (el título vive en el header P9c abajo). */}
        <nav
          aria-label="Ruta"
          className="flex flex-wrap items-center gap-1.5 text-[12px] leading-4 text-[var(--color-nachipa-muted)]"
        >
          <Link
            to="/prevencion"
            className="hover:text-[var(--color-nachipa-body)] hover:underline"
          >
            Prevención
          </Link>
          <span aria-hidden className="text-[var(--color-nachipa-placeholder)]">
            /
          </span>
          <Link
            to="/prevencion/contratistas"
            className="hover:text-[var(--color-nachipa-body)] hover:underline"
          >
            Contratistas
          </Link>
          <span aria-hidden className="text-[var(--color-nachipa-placeholder)]">
            /
          </span>
          <span
            className="text-[var(--color-nachipa-secondary)]"
            aria-current="page"
          >
            {displayName(org.name)}
          </span>
        </nav>

        {/* Header P9c: avatar + meta + chips + acciones. */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white px-5 py-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-nachipa-primary)_18%,white)] text-[14px] font-semibold text-[var(--color-nachipa-primary)]"
              aria-hidden
            >
              {orgInitials(org.name)}
            </span>
            <div className="min-w-0">
              <h1 className="m-0 text-[20px] font-semibold leading-tight text-[var(--color-nachipa-title)]">
                {displayName(org.name)}
              </h1>
              <p className="mt-1 m-0 text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
                {[
                  `RUT ${org.rut}`,
                  roleMeta(org.role),
                  `${org.personCount} ${org.personCount === 1 ? "persona" : "personas"}`,
                  org.contactEmail?.trim() || null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {habChip ? (
                  <StatusChip tone="success">{habChip}</StatusChip>
                ) : (
                  <StatusChip tone={org.active ? "success" : "neutral"}>
                    {org.active ? "Activa" : "Inactiva"}
                  </StatusChip>
                )}
                <StatusChip tone="neutral">
                  {orgUsers.length}{" "}
                  {orgUsers.length === 1 ? "usuario" : "usuarios"}
                </StatusChip>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canManage ? (
              <button
                type="button"
                className={`${outlineBtnClass} gap-1.5`}
                onClick={openEdit}
              >
                <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
                Editar datos
              </button>
            ) : null}
            {canInvite ? (
              <Button
                type="button"
                size="medium"
                className="!w-auto"
                onClick={openInvite}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                Invitar usuario
              </Button>
            ) : null}
            {canCreatePeople && tab === "personal" ? (
              <Button
                type="button"
                size="medium"
                className="!w-auto"
                onClick={openCreatePerson}
              >
                Agregar persona
              </Button>
            ) : null}
          </div>
        </div>

        {/* Tabs pill P9c. */}
        <div role="tablist" className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={[
                  "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-full)] px-3 text-[13px] font-medium transition",
                  selected
                    ? "bg-[var(--color-nachipa-primary)] text-white"
                    : "bg-[var(--color-nachipa-bg-page)] text-[var(--color-nachipa-secondary)] hover:text-[var(--color-nachipa-title)]",
                ].join(" ")}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {typeof t.count === "number" ? (
                  <span
                    className={[
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-white text-[var(--color-nachipa-secondary)]",
                    ].join(" ")}
                  >
                    {t.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {tab === "datos" ? (
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-5">
            <header className="mb-4">
              <h2 className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                Datos de la organización
              </h2>
              <p className="mt-1 m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                Los declaró la empresa y los revisó Prevención.
              </p>
            </header>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <TextField
                label="Razón social"
                value={displayName(org.name)}
                readOnly
              />
              <TextField label="RUT" value={org.rut} readOnly />
              <TextField label="Rol" value={roleShort(org.role)} readOnly />
              <TextField
                label="Especialidad"
                value={org.specialty?.trim() || "—"}
                readOnly
              />
              <TextField
                label="Contacto"
                value={org.contactName?.trim() || "—"}
                readOnly
              />
              <TextField
                label="Correo de contacto"
                value={org.contactEmail?.trim() || "—"}
                readOnly
              />
              <TextField
                label="Dirección"
                value={org.address?.trim() || "—"}
                readOnly
              />
              <TextField
                label="Mutualidad"
                value={org.mutual?.trim() || "—"}
                readOnly
              />
              <TextField
                label="Habilitada desde"
                value={
                  habChip
                    ? formatDate(
                        org.latestAccreditation?.reviewedAt ??
                          org.latestAccreditation?.submittedAt ??
                          org.latestAccreditation?.requestedAt,
                      )
                    : "—"
                }
                readOnly
              />
              <TextField
                label="Estado"
                value={
                  org.latestAccreditation?.status === "approved"
                    ? "Habilitada"
                    : org.active
                      ? "Activa"
                      : "Inactiva"
                }
                readOnly
              />
            </div>
          </section>
        ) : null}

        {tab === "habilitaciones" ? (
          !canReadHab ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Sin permiso accreditations.read.
            </p>
          ) : (
            <DataTableCard
              toolbar={
                <div className="flex w-full flex-wrap items-center gap-2">
                  <div className="min-w-[160px] flex-1">
                    <DataTableSearch
                      value={habSearch}
                      onChange={setHabSearch}
                      placeholder="Buscar HAB o mensaje…"
                    />
                  </div>
                  <select
                    className={filterSelectClass}
                    value={habStatusFilter}
                    aria-label="Filtro estado HAB"
                    onChange={(e) =>
                      setHabStatusFilter(e.target.value as HabStatusFilter)
                    }
                  >
                    <option value="">Estado: todos</option>
                    <option value="invited">Invitada</option>
                    <option value="pending">Pendiente</option>
                    <option value="in_review">En revisión</option>
                    <option value="observed">Observada</option>
                    <option value="approved">Aprobada</option>
                    <option value="rejected">Rechazada</option>
                  </select>
                  <DataTableOutlineButton
                    onClick={onExportHabs}
                    disabled={filteredHabs.length === 0}
                  >
                    Exportar
                  </DataTableOutlineButton>
                  <Link
                    to="/prevencion/habilitaciones"
                    className={`${outlineBtnClass} !h-8 !text-[12px]`}
                  >
                    Ir a bandeja
                  </Link>
                  {canCreateHab ? (
                    <Button
                      type="button"
                      size="medium"
                      className="!h-8 !w-auto !px-3 !text-[12px]"
                      onClick={openHabRequest}
                    >
                      <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
                      Solicitar documentación
                    </Button>
                  ) : null}
                </div>
              }
              footer={
                <TablePagination
                  totalLabel={`${habTotal} ${habTotal === 1 ? "habilitación" : "habilitaciones"}`}
                  page={habPage}
                  pageCount={habPageCount}
                  pageSize={habPageSize}
                  onPageChange={setHabPage}
                  onPageSizeChange={setHabPageSize}
                />
              }
            >
              {habs.length === 0 ? (
                <p className="m-0 px-1 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
                  Todavía no hay HAB.
                  {canCreateHab ? " Usá «Solicitar documentación»." : ""}
                </p>
              ) : habPageItems.length === 0 ? (
                <p className="m-0 px-1 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
                  Ninguna habilitación coincide con el filtro.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                    <thead>
                      <tr>
                        <TableHeaderCell rounded="left">Código</TableHeaderCell>
                        <TableHeaderCell>Estado</TableHeaderCell>
                        <TableHeaderCell>Solicitada</TableHeaderCell>
                        <TableHeaderCell>Plazo</TableHeaderCell>
                        <TableHeaderCell>Mensaje</TableHeaderCell>
                        <TableHeaderCell rounded="right" align="right">
                          Acciones
                        </TableHeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {habPageItems.map((h) => (
                        <tr
                          key={h.id}
                          className="border-t border-[var(--color-tremor-border)]"
                        >
                          <td className="px-3 py-2.5 font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                            <Link
                              to={`/prevencion/habilitaciones/${h.id}`}
                              className="text-[var(--color-nachipa-primary)] hover:underline"
                            >
                              {h.code}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusChip tone={statusTone(h.status)}>
                              {statusLabel(h.status)}
                            </StatusChip>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                            {formatDate(h.requestedAt)}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                            {formatDate(h.dueAt)}
                          </td>
                          <td className="max-w-[220px] truncate px-3 py-2.5 text-[var(--color-nachipa-secondary)]">
                            {h.message ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Link
                              to={`/prevencion/habilitaciones/${h.id}`}
                              className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                            >
                              Ver
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DataTableCard>
          )
        ) : null}

        {tab === "personal" ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Trabajadores externos de la organización ({people.length}).
            </p>
            {people.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Todavía no hay personal.
                {canCreatePeople ? " Usá «Agregar persona»." : ""}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white">
                <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                  <thead className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] text-[var(--color-nachipa-secondary)]">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Nombre</th>
                      <th className="px-3 py-2.5 font-medium">RUN</th>
                      <th className="px-3 py-2.5 font-medium">Cargo</th>
                      <th className="px-3 py-2.5 font-medium">Contacto</th>
                      <th className="px-3 py-2.5 font-medium">Estado</th>
                      <th className="px-3 py-2.5 font-medium text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p) => (
                      <tr
                        key={p.id}
                        className="border-t border-[var(--color-tremor-border)]"
                      >
                        <td className="px-3 py-2.5 text-[var(--color-nachipa-title)]">
                          {displayName(p.fullName)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                          {p.rut}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                          {p.position ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                          {p.email ?? p.phone ?? "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusChip tone={p.active ? "success" : "neutral"}>
                            {p.active ? "Activo" : "Inactivo"}
                          </StatusChip>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {canUpdatePeople ? (
                            <button
                              type="button"
                              className="mr-2 text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                              onClick={() => openEditPerson(p)}
                            >
                              Editar
                            </button>
                          ) : null}
                          {canDeactivatePeople && p.active ? (
                            <button
                              type="button"
                              className="text-[12px] font-medium text-[var(--color-status-danger-fg)] hover:underline"
                              onClick={() => setPendingDeactivatePerson(p)}
                            >
                              Desactivar
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === "usuarios" ? (
          <DataTableCard
            toolbar={
              <div className="flex w-full flex-wrap items-center gap-2">
                <div className="min-w-[200px] flex-1">
                  <DataTableSearch
                    value={userSearch}
                    onChange={setUserSearch}
                    placeholder="Buscar usuario…"
                  />
                </div>
                <select
                  className={filterSelectClass}
                  value={userStatusFilter}
                  aria-label="Filtro estado"
                  onChange={(e) =>
                    setUserStatusFilter(e.target.value as UserStatusFilter)
                  }
                >
                  <option value="">Estado: todos</option>
                  <option value="active">Activo</option>
                  <option value="invited">Invitado</option>
                  <option value="inactive">Inactivo</option>
                </select>
                <DataTableOutlineButton
                  onClick={onExportUsers}
                  disabled={filteredUsers.length === 0}
                >
                  Exportar
                </DataTableOutlineButton>
              </div>
            }
            footer={
              <TablePagination
                totalLabel={`${userTotal} ${userTotal === 1 ? "usuario" : "usuarios"}`}
                page={userPage}
                pageCount={userPageCount}
                pageSize={userPageSize}
                onPageChange={setUserPage}
                onPageSizeChange={setUserPageSize}
              />
            }
          >
            {orgUsers.length === 0 ? (
              <p className="m-0 px-1 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
                Todavía no hay invitados.
                {canInvite ? " Usá «Invitar usuario»." : ""}
              </p>
            ) : userPageItems.length === 0 ? (
              <p className="m-0 px-1 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
                Ningún usuario coincide con el filtro.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr>
                      <TableHeaderCell rounded="left">Usuario</TableHeaderCell>
                      <TableHeaderCell>Correo</TableHeaderCell>
                      <TableHeaderCell>Rol</TableHeaderCell>
                      <TableHeaderCell>Último acceso</TableHeaderCell>
                      <TableHeaderCell>Invitado por</TableHeaderCell>
                      <TableHeaderCell rounded="right">Estado</TableHeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {userPageItems.map((u) => (
                      <tr
                        key={u.id}
                        className="border-t border-[var(--color-tremor-border)]"
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-nachipa-primary)_16%,white)] text-[11px] font-semibold text-[var(--color-nachipa-primary)]"
                              aria-hidden
                            >
                              {userInitials(u.firstName, u.lastName)}
                            </span>
                            <span className="font-medium text-[var(--color-nachipa-title)]">
                              {displayName(`${u.firstName} ${u.lastName}`)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                          {u.email}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                          {userRoleLabel(u.internalRol)}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                          {formatLastAccess(u.lastLoginAt)}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                          {u.invitedBy
                            ? displayName(
                                `${u.invitedBy.firstName} ${u.invitedBy.lastName}`,
                              )
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusChip
                            tone={
                              !u.state
                                ? "neutral"
                                : u.invitePending
                                  ? "warning"
                                  : "success"
                            }
                          >
                            {!u.state
                              ? "Inactivo"
                              : u.invitePending
                                ? "Invitado"
                                : "Activo"}
                          </StatusChip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataTableCard>
        ) : null}

        {tab === "permisos" ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Permisos de trabajo: UI pendiente (sin API en este paso).
          </p>
        ) : null}
      </div>

      <Modal
        open={editOpen && Boolean(form)}
        onClose={() => {
          if (!submitting) setEditOpen(false);
        }}
        icon={Building2}
        title="Editar datos de la organización"
        subtitle="RUT no se cambia acá (identidad de la org)."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setEditOpen(false)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="contractor-detail-edit"
              size="medium"
              className="!w-auto"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      >
        {form ? (
          <form
            id="contractor-detail-edit"
            className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto"
            onSubmit={(e) => void onSubmit(e)}
          >
            <TextField
              label="Razón social"
              value={form.name}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, name: e.target.value } : f))
              }
              required
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Relación
              </span>
              <select
                className={selectClass}
                value={form.role}
                onChange={(e) =>
                  setForm((f) =>
                    f
                      ? { ...f, role: e.target.value as ContractorRole }
                      : f,
                  )
                }
              >
                <option value="occasional">Ocasional</option>
                <option value="permanent">Permanente</option>
              </select>
            </label>
            {(
              [
                ["specialty", "Especialidad"],
                ["contactName", "Contacto"],
                ["contactEmail", "Email contacto"],
                ["contactPhone", "Teléfono"],
                ["legalRepresentative", "Representante legal"],
                ["address", "Dirección"],
                ["mutual", "Mutual"],
                ["supervisorName", "Supervisor"],
                ["supervisorEmail", "Email supervisor"],
                ["prevencionistName", "Prevencionista"],
                ["prevencionistEmail", "Email prevencionista"],
                ["subcontractors", "Subcontratos"],
                ["workDescription", "Descripción del trabajo"],
              ] as const
            ).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={form[key]}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, [key]: e.target.value } : f,
                  )
                }
              />
            ))}
            <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-table-head-bg,#f8f9fb)] px-3.5 py-3">
              <span className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                Activa
              </span>
              <Toggle
                checked={form.active}
                onChange={(next) =>
                  setForm((f) => (f ? { ...f, active: next } : f))
                }
                aria-label="Organización activa"
              />
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={inviteOpen}
        onClose={() => {
          if (!inviting) setInviteOpen(false);
        }}
        icon={Building2}
        title="Invitar usuario"
        subtitle="Recibe un correo para definir su clave (mismo flujo que Acceso de tripulante)."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={inviting}
              onClick={() => setInviteOpen(false)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="contractor-invite-user"
              size="medium"
              className="!w-auto"
              disabled={inviting}
            >
              {inviting ? "Enviando…" : "Invitar"}
            </Button>
          </div>
        }
      >
        <form
          id="contractor-invite-user"
          className="flex flex-col gap-3"
          onSubmit={(e) => void onInvite(e)}
        >
          <TextField
            label="Email"
            type="email"
            value={inviteForm.email}
            onChange={(e) =>
              setInviteForm((f) => ({ ...f, email: e.target.value }))
            }
            required
          />
          <TextField
            label="Nombre"
            value={inviteForm.firstName}
            onChange={(e) =>
              setInviteForm((f) => ({ ...f, firstName: e.target.value }))
            }
            required
          />
          <TextField
            label="Apellido"
            value={inviteForm.lastName}
            onChange={(e) =>
              setInviteForm((f) => ({ ...f, lastName: e.target.value }))
            }
            required
          />
          <TextField
            label="RUN"
            value={inviteForm.run}
            onChange={(e) =>
              setInviteForm((f) => ({ ...f, run: e.target.value }))
            }
            required
          />
        </form>
      </Modal>

      <Modal
        open={personOpen}
        onClose={() => {
          if (!personSaving) setPersonOpen(false);
        }}
        icon={Building2}
        title={personEditing ? "Editar persona" : "Agregar persona"}
        subtitle="Personal externo de la organización contratista."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={personSaving}
              onClick={() => setPersonOpen(false)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="contractor-person-form"
              size="medium"
              className="!w-auto"
              disabled={personSaving}
            >
              {personSaving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      >
        <form
          id="contractor-person-form"
          className="flex flex-col gap-3"
          onSubmit={(e) => void onSavePerson(e)}
        >
          <TextField
            label="RUN"
            value={personForm.rut}
            onChange={(e) =>
              setPersonForm((f) => ({ ...f, rut: e.target.value }))
            }
            required
          />
          <TextField
            label="Nombre completo"
            value={personForm.fullName}
            onChange={(e) =>
              setPersonForm((f) => ({ ...f, fullName: e.target.value }))
            }
            required
          />
          <TextField
            label="Cargo"
            value={personForm.position}
            onChange={(e) =>
              setPersonForm((f) => ({ ...f, position: e.target.value }))
            }
          />
          <TextField
            label="Email"
            type="email"
            value={personForm.email}
            onChange={(e) =>
              setPersonForm((f) => ({ ...f, email: e.target.value }))
            }
          />
          <TextField
            label="Teléfono"
            value={personForm.phone}
            onChange={(e) =>
              setPersonForm((f) => ({ ...f, phone: e.target.value }))
            }
          />
          <TextField
            label="Contacto de emergencia"
            value={personForm.emergencyContact}
            onChange={(e) =>
              setPersonForm((f) => ({
                ...f,
                emergencyContact: e.target.value,
              }))
            }
          />
          {personEditing ? (
            <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-table-head-bg,#f8f9fb)] px-3.5 py-3">
              <span className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                Activo
              </span>
              <Toggle
                checked={personForm.active}
                onChange={(next) =>
                  setPersonForm((f) => ({ ...f, active: next }))
                }
                aria-label="Persona activa"
              />
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(pendingDeactivatePerson)}
        onClose={() => {
          if (!personSaving) setPendingDeactivatePerson(null);
        }}
        icon={Building2}
        title="Desactivar persona"
        subtitle={
          pendingDeactivatePerson
            ? `¿Desactivar «${displayName(pendingDeactivatePerson.fullName)}» (${pendingDeactivatePerson.rut})?`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={personSaving}
              onClick={() => setPendingDeactivatePerson(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={personSaving}
              onClick={() => void confirmDeactivatePerson()}
            >
              {personSaving ? "Desactivando…" : "Desactivar"}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[13px] text-[var(--color-nachipa-body)]">
          Soft delete: queda fuera del listado activo.
        </p>
      </Modal>

      {/* Solicitar documentación HAB desde la ficha. */}
      <Modal
        open={habRequestOpen}
        onClose={() => {
          if (!habRequesting) setHabRequestOpen(false);
        }}
        icon={ClipboardCheck}
        title="Solicitar documentación"
        subtitle={`Se crea una HAB para ${displayName(org.name)}.`}
        maxWidthClass="w-full max-w-[520px] sm:w-[520px]"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={habRequesting}
              onClick={() => setHabRequestOpen(false)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="contractor-detail-hab-request"
              size="medium"
              className="!w-auto"
              disabled={habRequesting}
            >
              {habRequesting ? "Solicitando…" : "Solicitar"}
            </Button>
          </div>
        }
      >
        <form
          id="contractor-detail-hab-request"
          className="flex flex-col gap-3"
          onSubmit={(e) => void onRequestHab(e)}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Mensaje al contratista
            </span>
            <textarea
              className="min-h-[96px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 py-2.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]"
              value={habMessage}
              onChange={(e) => setHabMessage(e.target.value)}
              placeholder="Indicaciones para subir el pack de documentos…"
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}
