import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Building2,
  ClipboardCheck,
  Pencil,
  Plus,
} from "lucide-react";
import { Link } from "react-router";
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
import { WorkPermitProgressCell } from "../../components/WorkPermitProgressCell/WorkPermitProgressCell";
import { downloadXls } from "../../lib/exportXls";
import {
  createAccreditationRequest,
  listAccreditationsRequest,
  type AccreditationStatus,
  type ContractorAccreditation,
} from "../../lib/api/accreditations";
import {
  contractorInviteRoleLabel,
  getContractorRequest,
  inviteContractorUserRequest,
  listContractorPeopleRequest,
  listContractorUsersRequest,
  updateContractorRequest,
  type ContractorInviteRoleKey,
  type ContractorOrganization,
  type ContractorPerson,
  type ContractorRole,
  type ContractorUser,
} from "../../lib/api/contractors";
import { userHasPermission } from "../../lib/api/auth";
import {
  listWorkPermitsRequest,
  workPermitStatusLabelFor,
  type WorkPermit,
  type WorkPermitStatus,
} from "../../lib/api/workPermits";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Ancho drawer ficha (~70% viewport; listado visible a la izq.). */
const FICHA_DRAWER_WIDTH = "w-full max-w-[min(1100px,72vw)] sm:w-[min(1100px,72vw)]";
/** Cuerpo a full height: el children arma header + tabs + scroll. */
const FICHA_BODY_CLASS = "flex min-h-0 flex-1 flex-col overflow-hidden p-0";

/** Tabs P9c (Figma). */
type TabId = "datos" | "usuarios" | "habilitacion" | "permisos";

/** Tono chip de estado de PT. */
function permitStatusTone(
  status: WorkPermitStatus,
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "active":
      return "success";
    case "to_approve":
      return "info";
    case "to_receive":
    case "to_verify":
    case "to_complete":
      return "warning";
    case "no_closure":
      return "danger";
    case "closed":
      return "neutral";
    default:
      return "neutral";
  }
}

/** Botón outline (Editar / Cancelar). */
const outlineBtnClass =
  "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/** Select de relación (P9m). */
const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

/** Form edición org (P9m). */
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

/** Form invitación (P9b · Figma Modal · Invitar usuario). */
type InviteForm = {
  /** Nombre completo; se parte en first/last al enviar. */
  fullName: string;
  email: string;
  /** Requerido por API (Figma no lo muestra; lo pedimos debajo). */
  run: string;
  /** Dueño (admin org) o faena (PT + pedir cierre). */
  roleKey: ContractorInviteRoleKey;
  /** Toggle «Enviar invitación por correo». */
  sendByEmail: boolean;
};

/** Parte «Nombre Apellido…» en firstName / lastName para el POST. */
function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Capitaliza palabras. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Iniciales del avatar (hasta 2 letras). */
function orgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Etiqueta rol larga (meta header). */
function roleLabel(role: ContractorRole): string {
  return role === "permanent" ? "Contratista permanente" : "Contratista ocasional";
}

/** Rol corto en el campo Datos. */
function roleShort(role: ContractorRole): string {
  return role === "permanent" ? "Permanente" : "Ocasional";
}

/** Fecha dd-mm-yyyy desde ISO. */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Etiqueta HAB. */
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

/** Texto chip “Habilitada desde …” si HAB aprobada. */
function habilitadaChip(org: ContractorOrganization): string | null {
  const hab = org.latestAccreditation;
  if (!hab || hab.status !== "approved") return null;
  const from = formatDate(hab.reviewedAt ?? hab.submittedAt ?? hab.requestedAt);
  if (from === "—") return "Habilitada";
  return `Habilitada desde ${from}`;
}

/** Iniciales celda Usuario (P9). */
function userInitials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return `${a}${b}`.toUpperCase() || "?";
}

/** Rol visible en tabla Usuarios (portal dueño / faena). */
function userRoleLabel(internalRol: string): string {
  return contractorInviteRoleLabel(internalRol);
}

/** Último acceso relativo corto. */
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
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (diffDays === 0) return `hoy ${time}`;
  if (diffDays === 1) return `ayer ${time}`;
  return `${formatDate(iso)} ${time}`;
}

/** Select filtro toolbar Usuarios. */
const filterSelectClass =
  "h-8 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[12px] text-[var(--color-nachipa-body)] outline-none";

/** Filtro estado tab Usuarios. */
type UserStatusFilter = "" | "active" | "invited" | "inactive";

/** Filtro estado tab Habilitación (vacío = todos). */
type HabStatusFilter = "" | AccreditationStatus;

type Props = {
  /** Id de org; null = cerrado. */
  organizationId: string | null;
  onClose: () => void;
};

/**
 * Ficha org en drawer (P9c) + modales P9m (editar) y P9b (invitar).
 */
export function ContractorFichaModal({ organizationId, onClose }: Props) {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const open = Boolean(organizationId);
  /** Acciones de escritura sobre la organización (no por internalRol). */
  const canManage =
    userHasPermission(user, "contractors", "update") ||
    userHasPermission(user, "contractors", "deactivate");
  const canInvite = userHasPermission(user, "contractors", "create");
  const canReadHab = userHasPermission(user, "accreditations", "read");
  const canCreateHab = userHasPermission(user, "accreditations", "create");
  const canReadPermits = userHasPermission(user, "work_permits", "read");

  const [tab, setTab] = useState<TabId>("datos");
  const [loading, setLoading] = useState(false);
  const [org, setOrg] = useState<ContractorOrganization | null>(null);
  const [habs, setHabs] = useState<ContractorAccreditation[]>([]);
  /** Ya habilitada: no re-solicitar pack; docs extras van en la HAB aprobada. */
  const hasApprovedHab = habs.some((h) => h.status === "approved");
  const canRequestPack = canCreateHab && !hasApprovedHab;
  const [people, setPeople] = useState<ContractorPerson[]>([]);
  const [users, setUsers] = useState<ContractorUser[]>([]);
  const [permits, setPermits] = useState<WorkPermit[]>([]);
  const [permitSearch, setPermitSearch] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    fullName: "",
    email: "",
    run: "",
    roleKey: "contratista",
    sendByEmail: true,
  });
  const [inviting, setInviting] = useState(false);

  /** Toolbar Usuarios (P9) dentro del drawer. */
  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] =
    useState<UserStatusFilter>("");

  /** Toolbar Habilitación (mismo patrón DataTable que Usuarios / bandeja). */
  const [habSearch, setHabSearch] = useState("");
  const [habStatusFilter, setHabStatusFilter] = useState<HabStatusFilter>("");
  const [habRequestOpen, setHabRequestOpen] = useState(false);
  const [habMessage, setHabMessage] = useState(
    "Favor subir la documentación del pack empresa para habilitación.",
  );
  const [habRequesting, setHabRequesting] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (userStatusFilter === "active" && (!u.state || u.invitePending)) {
        return false;
      }
      if (userStatusFilter === "invited" && !u.invitePending) return false;
      if (userStatusFilter === "inactive" && u.state) return false;
      if (!q) return true;
      const hay =
        `${u.firstName} ${u.lastName} ${u.email} ${u.run}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, userSearch, userStatusFilter]);

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

  /** PT de esta org (filtro local). */
  const filteredPermits = useMemo(() => {
    const q = permitSearch.trim().toLowerCase();
    if (!q) return permits;
    return permits.filter((p) => {
      const hay =
        `${p.code} ${p.permitType.code} ${p.permitType.name} ${p.location.name} ${p.workNotice.code}`.toLowerCase();
      return hay.includes(q);
    });
  }, [permits, permitSearch]);

  const {
    pageItems: permitPageItems,
    page: permitPage,
    setPage: setPermitPage,
    pageSize: permitPageSize,
    setPageSize: setPermitPageSize,
    pageCount: permitPageCount,
    total: permitTotal,
  } = useClientTablePagination(filteredPermits);

  /** Exporta usuarios filtrados del drawer. */
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

  /** Abre modal solicitar documentación (org ya fijada). */
  function openHabRequest() {
    setHabMessage(
      "Favor subir la documentación del pack empresa para habilitación.",
    );
    setHabRequestOpen(true);
  }

  /** POST /accreditations para esta organización. */
  async function onRequestHab(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !org || habRequesting || !canRequestPack) return;
    setHabRequesting(true);
    try {
      await createAccreditationRequest(accessToken, {
        organizationId: org.id,
        message: habMessage.trim() || null,
        dueAt: null,
      });
      showToast("Solicitud de documentación creada.", "success");
      setHabRequestOpen(false);
      setTab("habilitacion");
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

  /** Exporta HABs filtradas del drawer. */
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
    if (!accessToken || !organizationId) return;
    setLoading(true);
    try {
      const row = await getContractorRequest(accessToken, organizationId);
      setOrg(row);
      const [peopleRes, usersRes] = await Promise.all([
        listContractorPeopleRequest(accessToken, organizationId, 1, 50, {
          active: true,
        }),
        listContractorUsersRequest(accessToken, organizationId, 1, 50),
      ]);
      setPeople(peopleRes.items);
      setUsers(usersRes.items);
      if (canReadHab) {
        const habRes = await listAccreditationsRequest(
          accessToken,
          1,
          50,
          { organizationId },
        );
        setHabs(habRes.items);
      } else {
        setHabs([]);
      }
      if (canReadPermits) {
        const permitRes = await listWorkPermitsRequest(accessToken, 1, 100, {
          organizationId,
        });
        setPermits(permitRes.items);
      } else {
        setPermits([]);
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cargar la ficha",
        "danger",
      );
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId, canReadHab, canReadPermits, showToast]);

  useEffect(() => {
    if (!open) {
      setTab("datos");
      setOrg(null);
      setEditOpen(false);
      setInviteOpen(false);
      setForm(null);
      setUserSearch("");
      setUserStatusFilter("");
      setPermitSearch("");
      setPermits([]);
      return;
    }
    void load();
  }, [open, load]);

  /** Abre P9m con datos actuales. */
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

  /** PATCH org (P9m). */
  async function onSubmitEdit(e: FormEvent) {
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

  /** Abre P9b vacío (Figma). */
  function openInvite() {
    setInviteForm({
      fullName: "",
      email: "",
      run: "",
      roleKey: "contratista",
      sendByEmail: true,
    });
    setInviteOpen(true);
  }

  /** POST invitación (P9b). */
  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !org || inviting) return;
    if (!inviteForm.sendByEmail) {
      showToast("Activá el envío por correo para invitar.", "danger");
      return;
    }
    const { firstName, lastName } = splitFullName(inviteForm.fullName);
    if (
      !inviteForm.email.trim() ||
      !firstName ||
      !lastName ||
      !inviteForm.run.trim()
    ) {
      showToast("Completá nombre, correo y RUN.", "danger");
      return;
    }
    setInviting(true);
    try {
      await inviteContractorUserRequest(accessToken, org.id, {
        email: inviteForm.email.trim().toLowerCase(),
        firstName,
        lastName,
        run: inviteForm.run.trim(),
        roleKey: inviteForm.roleKey,
      });
      showToast("Invitación enviada.", "success");
      setInviteOpen(false);
      setTab("usuarios");
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

  const personCount = org?.personCount ?? people.length;
  const userCount = users.length;
  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "datos", label: "Datos" },
    { id: "usuarios", label: "Usuarios", count: userCount },
    { id: "habilitacion", label: "Habilitación", count: habs.length },
    { id: "permisos", label: "Permisos de trabajo", count: permits.length },
  ];

  const titleName = org ? displayName(org.name) : "Organización";
  const habChip = org ? habilitadaChip(org) : null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        variant="drawer"
        hideHeader
        title={titleName}
        maxWidthClass={FICHA_DRAWER_WIDTH}
        bodyClassName={FICHA_BODY_CLASS}
      >
        <div className="shrink-0 border-b border-[var(--color-tremor-border)] px-6 pb-4 pt-5 pr-12">
          {loading && !org ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Cargando ficha…
            </p>
          ) : !org ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              No se encontró la organización.
            </p>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-nachipa-primary)_18%,white)] text-[14px] font-semibold text-[var(--color-nachipa-primary)]"
                  aria-hidden
                >
                  {orgInitials(org.name)}
                </span>
                <div className="min-w-0">
                  <h3 className="m-0 text-[20px] font-semibold leading-tight text-[var(--color-nachipa-title)]">
                    {titleName}
                  </h3>
                  <p className="mt-1 m-0 text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
                    {[
                      `RUT ${org.rut}`,
                      roleLabel(org.role),
                      `${personCount} ${personCount === 1 ? "persona" : "personas"}`,
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
                      {userCount} {userCount === 1 ? "usuario" : "usuarios"}
                    </StatusChip>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {canManage ? (
                  <button
                    type="button"
                    className={outlineBtnClass}
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
              </div>
            </div>
          )}
        </div>

        <div
          role="tablist"
          className="flex shrink-0 flex-wrap gap-2 border-b border-[var(--color-tremor-border)] px-6 py-3"
        >
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

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!org ? null : tab === "datos" ? (
            <section className="rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-5">
              <header className="mb-4">
                <h4 className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                  Datos de la organización
                </h4>
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
          ) : tab === "usuarios" ? (
            <DataTableCard
              toolbar={
                <div className="flex w-full flex-wrap items-center gap-2">
                  <div className="min-w-[160px] flex-1">
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
              {users.length === 0 ? (
                <p className="m-0 px-1 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
                  Todavía no hay usuarios invitados.
                  {canInvite ? " Usá «Invitar usuario»." : ""}
                </p>
              ) : userPageItems.length === 0 ? (
                <p className="m-0 px-1 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
                  Ningún usuario coincide con el filtro.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
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
          ) : tab === "habilitacion" ? (
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
                    {canRequestPack ? (
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
                    {canCreateHab && hasApprovedHab ? (
                      <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                        Ya habilitada · docs adicionales en la HAB aprobada
                      </span>
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
                    {canRequestPack
                      ? " Usá «Solicitar documentación»."
                      : ""}
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
                                onClick={onClose}
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
                                onClick={onClose}
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
          ) : tab === "permisos" ? (
            !canReadPermits ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                No tenés permiso para ver permisos de trabajo.
              </p>
            ) : (
              <DataTableCard
                toolbar={
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <div className="min-w-[160px] flex-1">
                      <DataTableSearch
                        value={permitSearch}
                        onChange={(v) => {
                          setPermitSearch(v);
                          setPermitPage(1);
                        }}
                        placeholder="Buscar por código, tipo o nave…"
                      />
                    </div>
                    <Link
                      to="/prevencion/permisos"
                      className={`${outlineBtnClass} !h-8 !text-[12px]`}
                      onClick={onClose}
                    >
                      Ir a bandeja
                    </Link>
                  </div>
                }
                footer={
                  <TablePagination
                    totalLabel={`${permitTotal} ${
                      permitTotal === 1 ? "permiso" : "permisos"
                    }`}
                    page={permitPage}
                    pageCount={permitPageCount}
                    pageSize={permitPageSize}
                    onPageChange={setPermitPage}
                    onPageSizeChange={setPermitPageSize}
                  />
                }
              >
                {permits.length === 0 ? (
                  <p className="m-0 px-1 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
                    Todavía no hay permisos. Creá uno desde{" "}
                    <Link
                      to="/prevencion/avisos"
                      className="font-medium text-[var(--color-nachipa-primary)] hover:underline"
                      onClick={onClose}
                    >
                      Avisos de trabajo
                    </Link>
                    .
                  </p>
                ) : permitPageItems.length === 0 ? (
                  <p className="m-0 px-1 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
                    Ningún permiso coincide con la búsqueda.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                      <thead>
                        <tr>
                          <TableHeaderCell rounded="left">
                            Código
                          </TableHeaderCell>
                          <TableHeaderCell>Tipo</TableHeaderCell>
                          <TableHeaderCell>Nave</TableHeaderCell>
                          <TableHeaderCell>Fecha</TableHeaderCell>
                          <TableHeaderCell>Estado</TableHeaderCell>
                          <TableHeaderCell>Avance</TableHeaderCell>
                          <TableHeaderCell rounded="right" align="right">
                            Acciones
                          </TableHeaderCell>
                        </tr>
                      </thead>
                      <tbody>
                        {permitPageItems.map((p) => (
                          <tr
                            key={p.id}
                            className="border-t border-[var(--color-tremor-border)]"
                          >
                            <td className="px-3 py-2.5 font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                              <Link
                                to={`/prevencion/permisos/${p.id}`}
                                className="text-[var(--color-nachipa-primary)] hover:underline"
                                onClick={onClose}
                              >
                                {p.code}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                              {p.permitType.code}
                            </td>
                            <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                              {displayName(p.location.name)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                              {formatDate(p.scheduledDate)}
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusChip tone={permitStatusTone(p.status)}>
                                {workPermitStatusLabelFor(p)}
                              </StatusChip>
                            </td>
                            <td className="px-3 py-2.5">
                              <WorkPermitProgressCell status={p.status} />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <Link
                                to={`/prevencion/permisos/${p.id}`}
                                className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                                onClick={onClose}
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
        </div>
      </Modal>

      {/* P9m · Editar datos (modal centrado sobre el drawer). */}
      <Modal
        open={editOpen && Boolean(form)}
        onClose={() => {
          if (!submitting) setEditOpen(false);
        }}
        icon={Building2}
        title="Editar datos de la organización"
        subtitle="RUT no se cambia acá (identidad de la org)."
        maxWidthClass="w-full max-w-[640px] sm:w-[640px]"
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
              form="contractor-ficha-edit"
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
            id="contractor-ficha-edit"
            className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto"
            onSubmit={(e) => void onSubmitEdit(e)}
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

      {/* P9b · Invitar usuario (Figma 455:43996). */}
      <Modal
        open={inviteOpen}
        onClose={() => {
          if (!inviting) setInviteOpen(false);
        }}
        title="Invitar usuario"
        subtitle={org ? displayName(org.name) : undefined}
        maxWidthClass="w-full max-w-[560px] sm:w-[560px]"
        footer={
          <div className="flex justify-end gap-3">
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
              form="contractor-ficha-invite"
              size="medium"
              className="!w-auto"
              disabled={inviting || !inviteForm.sendByEmail}
            >
              {inviting ? "Enviando…" : "Enviar invitación"}
            </Button>
          </div>
        }
      >
        <form
          id="contractor-ficha-invite"
          className="flex flex-col gap-4"
          onSubmit={(e) => void onInvite(e)}
        >
          {/* Fila Nombre (160) + Correo (flex). */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
            <div className="w-full shrink-0 sm:w-[160px]">
              <TextField
                label="Nombre"
                value={inviteForm.fullName}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, fullName: e.target.value }))
                }
                placeholder="Camila Rojas"
                required
              />
            </div>
            <div className="min-w-0 flex-1">
              <TextField
                label="Correo"
                type="email"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="camila.rojas@navalsur.cl"
                required
              />
            </div>
          </div>

          {/* Rol portal (dueño vs faena) + vencimiento fijo del link. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--color-nachipa-body)]">
                Rol
              </label>
              <select
                className={selectClass}
                value={inviteForm.roleKey}
                onChange={(e) =>
                  setInviteForm((f) => ({
                    ...f,
                    roleKey: e.target.value as ContractorInviteRoleKey,
                  }))
                }
                aria-label="Rol del invitado"
              >
                <option value="contratista">
                  Dueño · administra empresa
                </option>
                <option value="contratista_faena">
                  Faena · ver permisos y pedir cierre
                </option>
              </select>
            </div>
            <div className="w-full shrink-0 sm:w-[160px]">
              <TextField label="Vence la invitación" value="72 horas" readOnly />
            </div>
          </div>

          {/* RUN: lo exige la API; Figma P9b no lo dibuja. */}
          <TextField
            label="RUN"
            value={inviteForm.run}
            onChange={(e) =>
              setInviteForm((f) => ({ ...f, run: e.target.value }))
            }
            placeholder="12.345.678-9"
            required
          />

          <div className="flex items-center gap-3 rounded-[14px] border border-[var(--color-tremor-border)] bg-white px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                Enviar invitación por correo
              </p>
              <p className="m-0 mt-0.5 text-[12px] text-[var(--color-nachipa-secondary)]">
                Link de un solo uso; si vence, se puede reenviar
              </p>
            </div>
            <Toggle
              checked={inviteForm.sendByEmail}
              onChange={(next) =>
                setInviteForm((f) => ({ ...f, sendByEmail: next }))
              }
              aria-label="Enviar invitación por correo"
            />
          </div>

          <div className="rounded-lg bg-[var(--color-status-info-bg,#e0f2fe)] px-3 py-2.5">
            <p className="m-0 text-[12px] leading-normal text-[var(--color-status-info-fg,#0284c7)]">
              El usuario solo verá los datos de esta organización (dataScope
              external).
            </p>
          </div>
        </form>
      </Modal>

      {/* Solicitar documentación HAB (org fijada; mismo contrato que bandeja). */}
      <Modal
        open={habRequestOpen}
        onClose={() => {
          if (!habRequesting) setHabRequestOpen(false);
        }}
        icon={ClipboardCheck}
        title="Solicitar documentación"
        subtitle={
          org
            ? `Se crea una HAB para ${displayName(org.name)}.`
            : "Se crea una HAB para esta organización."
        }
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
              form="contractor-ficha-hab-request"
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
          id="contractor-ficha-hab-request"
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
    </>
  );
}
