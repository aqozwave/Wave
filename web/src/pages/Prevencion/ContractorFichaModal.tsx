import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, Pencil, Plus } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  listAccreditationsRequest,
  type AccreditationStatus,
  type ContractorAccreditation,
} from "../../lib/api/accreditations";
import {
  getContractorRequest,
  inviteContractorUserRequest,
  listContractorPeopleRequest,
  listContractorUsersRequest,
  updateContractorRequest,
  type ContractorOrganization,
  type ContractorPerson,
  type ContractorRole,
  type ContractorUser,
} from "../../lib/api/contractors";
import { userHasPermission } from "../../lib/api/auth";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Ancho drawer ficha (~70% viewport; listado visible a la izq.). */
const FICHA_DRAWER_WIDTH = "w-full max-w-[min(1100px,72vw)] sm:w-[min(1100px,72vw)]";
/** Cuerpo a full height: el children arma header + tabs + scroll. */
const FICHA_BODY_CLASS = "flex min-h-0 flex-1 flex-col overflow-hidden p-0";

/** Tabs P9c (Figma). */
type TabId = "datos" | "usuarios" | "habilitacion" | "permisos";

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

/** Form invitación (P9b). */
type InviteForm = {
  email: string;
  firstName: string;
  lastName: string;
  run: string;
};

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
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";
  const canInvite =
    canManage && userHasPermission(user, "contractors", "create");
  const canReadHab = userHasPermission(user, "accreditations", "read");

  const [tab, setTab] = useState<TabId>("datos");
  const [loading, setLoading] = useState(false);
  const [org, setOrg] = useState<ContractorOrganization | null>(null);
  const [habs, setHabs] = useState<ContractorAccreditation[]>([]);
  const [people, setPeople] = useState<ContractorPerson[]>([]);
  const [users, setUsers] = useState<ContractorUser[]>([]);

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
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cargar la ficha",
        "danger",
      );
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId, canReadHab, showToast]);

  useEffect(() => {
    if (!open) {
      setTab("datos");
      setOrg(null);
      setEditOpen(false);
      setInviteOpen(false);
      setForm(null);
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

  /** Abre P9b vacío. */
  function openInvite() {
    setInviteForm({ email: "", firstName: "", lastName: "", run: "" });
    setInviteOpen(true);
  }

  /** POST invitación (P9b). */
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
  /** Sin API de PT en este paso: sin badge. */
  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "datos", label: "Datos" },
    { id: "usuarios", label: "Usuarios", count: userCount },
    { id: "habilitacion", label: "Habilitación" },
    { id: "permisos", label: "Permisos de trabajo" },
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
            users.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Todavía no hay usuarios invitados.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--color-tremor-border)] rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-0">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 font-medium text-[var(--color-nachipa-title)]">
                      {displayName(`${u.firstName} ${u.lastName}`)}
                    </span>
                    <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                      {u.email}
                    </span>
                    <StatusChip
                      tone={
                        u.invitePending
                          ? "warning"
                          : u.state
                            ? "success"
                            : "neutral"
                      }
                    >
                      {u.invitePending
                        ? "Invitado"
                        : u.state
                          ? "Activo"
                          : "Inactivo"}
                    </StatusChip>
                  </li>
                ))}
              </ul>
            )
          ) : tab === "habilitacion" ? (
            !canReadHab ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Sin permiso accreditations.read.
              </p>
            ) : habs.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Todavía no hay HAB.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--color-tremor-border)] rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-0">
                {habs.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                    <Link
                      to={`/prevencion/habilitaciones/${h.id}`}
                      className="w-24 shrink-0 font-semibold tabular-nums text-[var(--color-nachipa-primary)] hover:underline"
                      onClick={onClose}
                    >
                      {h.code}
                    </Link>
                    <StatusChip tone={statusTone(h.status)}>
                      {statusLabel(h.status)}
                    </StatusChip>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-nachipa-secondary)]">
                      {h.message ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Permisos de trabajo: UI pendiente (sin API en este paso).
            </p>
          )}
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

      {/* P9b · Invitar usuario. */}
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
              form="contractor-ficha-invite"
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
          id="contractor-ficha-invite"
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
    </>
  );
}
