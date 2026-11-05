import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Building2, Pencil } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  listAccreditationsRequest,
  type AccreditationStatus,
  type ContractorAccreditation,
} from "../../lib/api/accreditations";
import {
  getContractorRequest,
  inviteContractorUserRequest,
  listContractorUsersRequest,
  updateContractorRequest,
  type ContractorOrganization,
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

/** Etiqueta role. */
function roleLabel(role: ContractorRole): string {
  return role === "permanent" ? "Permanente" : "Ocasional";
}

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

/** Tabs de la ficha (P9). */
type TabId = "datos" | "habilitaciones" | "usuarios";

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

/** Fila de dato en la ficha. */
function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[var(--color-tremor-border)] py-2.5 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="w-44 shrink-0 text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
        {label}
      </dt>
      <dd className="m-0 min-w-0 text-[13px] text-[var(--color-nachipa-body)]">
        {value || "—"}
      </dd>
    </div>
  );
}

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
  const canReadHab = userHasPermission(user, "accreditations", "read");

  const [org, setOrg] = useState<ContractorOrganization | null>(null);
  const [habs, setHabs] = useState<ContractorAccreditation[]>([]);
  const [orgUsers, setOrgUsers] = useState<ContractorUser[]>([]);
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

  const tabs: { id: TabId; label: string }[] = [
    { id: "datos", label: "Datos" },
    { id: "habilitaciones", label: "Habilitaciones" },
    { id: "usuarios", label: "Usuarios" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Prevención"
        breadcrumbIcon={Building2}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Contratistas", to: "/prevencion/contratistas" },
            { label: displayName(org.name) },
          ]}
          title={displayName(org.name)}
          description={`${org.rut} · ${roleLabel(org.role)}`}
          actions={
            canManage && tab === "datos" ? (
              <Button
                type="button"
                size="medium"
                className="!w-auto"
                onClick={openEdit}
              >
                <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
                Editar datos
              </Button>
            ) : canInvite && tab === "usuarios" ? (
              <Button
                type="button"
                size="medium"
                className="!w-auto"
                onClick={openInvite}
              >
                Invitar usuario
              </Button>
            ) : null
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={org.active ? "success" : "neutral"}>
            {org.active ? "Activa" : "Inactiva"}
          </StatusChip>
          <StatusChip tone={org.role === "permanent" ? "info" : "neutral"}>
            {roleLabel(org.role)}
          </StatusChip>
          {org.specialty ? (
            <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
              {org.specialty}
            </span>
          ) : null}
        </div>

        <div
          role="tablist"
          className="flex gap-1 border-b border-[var(--color-tremor-border)]"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={[
                "px-3 py-2 text-[13px] font-medium",
                tab === t.id
                  ? "border-b-2 border-[var(--color-nachipa-primary)] text-[var(--color-nachipa-title)]"
                  : "text-[var(--color-nachipa-secondary)] hover:text-[var(--color-nachipa-title)]",
              ].join(" ")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "datos" ? (
          <dl className="m-0 max-w-2xl rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white px-4 py-1">
            <DataRow label="RUT" value={org.rut} />
            <DataRow label="Razón social" value={displayName(org.name)} />
            <DataRow label="Relación" value={roleLabel(org.role)} />
            <DataRow label="Especialidad" value={org.specialty ?? ""} />
            <DataRow label="Contacto" value={org.contactName ?? ""} />
            <DataRow label="Email" value={org.contactEmail ?? ""} />
            <DataRow label="Teléfono" value={org.contactPhone ?? ""} />
            <DataRow
              label="Rep. legal"
              value={org.legalRepresentative ?? ""}
            />
            <DataRow label="Dirección" value={org.address ?? ""} />
            <DataRow label="Mutual" value={org.mutual ?? ""} />
            <DataRow label="Supervisor" value={org.supervisorName ?? ""} />
            <DataRow
              label="Email supervisor"
              value={org.supervisorEmail ?? ""}
            />
            <DataRow
              label="Prevencionista"
              value={org.prevencionistName ?? ""}
            />
            <DataRow
              label="Email prevencionista"
              value={org.prevencionistEmail ?? ""}
            />
            <DataRow label="Subcontratos" value={org.subcontractors ?? ""} />
            <DataRow
              label="Descripción trabajo"
              value={org.workDescription ?? ""}
            />
          </dl>
        ) : null}

        {tab === "habilitaciones" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Habilitaciones de esta organización.
              </p>
              {canReadHab ? (
                <Link
                  to="/prevencion/habilitaciones"
                  className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                >
                  Ir a bandeja
                </Link>
              ) : null}
            </div>
            {!canReadHab ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Sin permiso accreditations.read.
              </p>
            ) : habs.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Todavía no hay HAB. Solicitala desde Habilitaciones.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--color-tremor-border)] rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-0">
                {habs.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="w-24 shrink-0 font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                      {h.code}
                    </span>
                    <StatusChip tone={statusTone(h.status)}>
                      {statusLabel(h.status)}
                    </StatusChip>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-nachipa-secondary)]">
                      {h.message ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "usuarios" ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Usuarios invitados al portal de esta organización.
            </p>
            {orgUsers.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Todavía no hay invitados.
                {canInvite ? " Usá «Invitar usuario»." : ""}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white">
                <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                  <thead className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] text-[var(--color-nachipa-secondary)]">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Nombre</th>
                      <th className="px-3 py-2.5 font-medium">RUN</th>
                      <th className="px-3 py-2.5 font-medium">Email</th>
                      <th className="px-3 py-2.5 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="border-t border-[var(--color-tremor-border)]"
                      >
                        <td className="px-3 py-2.5 text-[var(--color-nachipa-title)]">
                          {displayName(`${u.firstName} ${u.lastName}`)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                          {u.run}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                          {u.email}
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
                                ? "Invitación pendiente"
                                : "Activo"}
                          </StatusChip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
    </div>
  );
}
