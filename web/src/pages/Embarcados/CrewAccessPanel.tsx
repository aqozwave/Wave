import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KeyRound, Link2Off, UserPlus } from "lucide-react";

import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { TextField } from "../../components/TextField/TextField";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  changeCrewMemberAccessRoleRequest,
  getCrewMemberAccessRequest,
  grantCrewMemberAccessRequest,
  revokeCrewMemberAccessRequest,
  type CrewAccess,
  type CrewAccessRoleKey,
} from "../../lib/api/crewMembers";
import { userHasPermission } from "../../lib/api/auth";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

type Props = {
  /** Id del tripulante de la ficha. */
  crewMemberId: string;
  /** Email del tripulante (prefill del modal otorgar). */
  crewEmail: string;
  /** Nombre visible para textos del modal. */
  crewDisplayName: string;
};

/** Clase de selects del panel. */
const selectClass =
  "h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-nachipa-primary)]";

/** Fecha/hora local corta para último login. */
function formatLastLogin(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Pestaña Acceso (Figma D44 / D44b / D45 / D46 / D44m).
 * Empty → otorgar; vinculado → rol User/Colaborador + desvincular.
 * Mutaciones: embarcados.update (API grant/patch/revoke).
 */
export function CrewAccessPanel({
  crewMemberId,
  crewEmail,
  crewDisplayName,
}: Props) {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();

  /**
   * Otorgar / cambiar rol / desvincular: la API exige embarcados.update
   * (no maestros.users — el recurso de la ficha es embarcados).
   */
  const canUpdate = userHasPermission(user, "embarcados", "update");
  const canManage = canUpdate;

  const [access, setAccess] = useState<CrewAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantEmail, setGrantEmail] = useState(crewEmail);
  const [grantRole, setGrantRole] = useState<CrewAccessRoleKey>("user");

  const [revokeOpen, setRevokeOpen] = useState(false);

  /** Carga el estado Acceso desde el API. */
  const reload = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const row = await getCrewMemberAccessRequest(accessToken, crewMemberId);
      setAccess(row);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cargar Acceso.",
        "danger",
      );
      setAccess(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, crewMemberId, showToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setGrantEmail(crewEmail);
  }, [crewEmail]);

  /** Abre modal otorgar con defaults. */
  function openGrant() {
    setGrantEmail(crewEmail);
    setGrantRole("user");
    setGrantOpen(true);
  }

  /** POST otorgar acceso. */
  async function onGrant(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || busy) return;
    setBusy(true);
    try {
      const row = await grantCrewMemberAccessRequest(accessToken, crewMemberId, {
        email: grantEmail.trim() || undefined,
        roleKey: grantRole,
      });
      setAccess(row);
      setGrantOpen(false);
      showToast(
        row.invitePending
          ? "Acceso otorgado. Se envió el enlace para definir la clave."
          : "Cuenta vinculada correctamente.",
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo otorgar acceso.",
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }

  /** PATCH cambiar rol User ↔ Colaborador. */
  async function onChangeRole(roleKey: CrewAccessRoleKey) {
    if (!accessToken || busy) return;
    if (access?.user?.roleKey === roleKey) return;
    setBusy(true);
    try {
      const row = await changeCrewMemberAccessRoleRequest(
        accessToken,
        crewMemberId,
        { roleKey },
      );
      setAccess(row);
      showToast(
        roleKey === "colaborador"
          ? "Rol actualizado a Colaborador (capitán / supervisor de nave)."
          : "Rol actualizado a User (tripulante).",
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cambiar el rol.",
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }

  /** DELETE desvincular. */
  async function onRevoke() {
    if (!accessToken || busy) return;
    setBusy(true);
    try {
      const row = await revokeCrewMemberAccessRequest(accessToken, crewMemberId);
      setAccess(row);
      setRevokeOpen(false);
      showToast("Acceso desvinculado. La cuenta de usuario se conserva.", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo desvincular.",
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5">
        <p className="text-[13px] text-[var(--color-nachipa-secondary)]">
          Cargando acceso…
        </p>
      </div>
    );
  }

  // Empty state (D44b).
  if (!access?.linked || !access.user) {
    return (
      <>
        <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-6">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-status-info-bg)] text-[var(--color-nachipa-primary)]">
              <KeyRound className="size-5" strokeWidth={1.5} aria-hidden />
            </span>
            <h2 className="mt-4 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
              Sin acceso al portal
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-[var(--color-nachipa-secondary)]">
              {crewDisplayName} aún no tiene una cuenta vinculada. Otorgá acceso
              para que pueda iniciar sesión (por ejemplo como capitán a bordo).
            </p>
            {canManage ? (
              <Button
                type="button"
                size="medium"
                className="mt-5 !w-auto"
                onClick={openGrant}
              >
                <UserPlus className="size-4" strokeWidth={1.5} aria-hidden />
                Otorgar acceso
              </Button>
            ) : (
              <p className="mt-4 text-[12px] text-[var(--color-nachipa-secondary)]">
                No tenés permiso para otorgar acceso (embarcados.update).
              </p>
            )}
          </div>
        </div>

        <Modal
          open={grantOpen}
          onClose={() => {
            if (!busy) setGrantOpen(false);
          }}
          icon={UserPlus}
          title="Otorgar acceso"
          subtitle="Se creará o vinculará una cuenta y se enviará un enlace para definir la clave."
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setGrantOpen(false)}
                className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
              >
                Cancelar
              </button>
              <Button
                type="submit"
                form="grant-access-form"
                size="medium"
                className="!w-auto"
                disabled={busy || !grantEmail.trim()}
              >
                {busy ? "Otorgando…" : "Otorgar acceso"}
              </Button>
            </div>
          }
        >
          <form
            id="grant-access-form"
            className="flex flex-col gap-4"
            onSubmit={(e) => void onGrant(e)}
          >
            <TextField
              label="Correo"
              type="email"
              required
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              autoComplete="off"
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Rol inicial
              </span>
              <select
                className={selectClass}
                value={grantRole}
                onChange={(e) =>
                  setGrantRole(e.target.value as CrewAccessRoleKey)
                }
              >
                <option value="user">User (tripulante de nave)</option>
                <option value="colaborador">
                  Colaborador (capitán / supervisor)
                </option>
              </select>
            </label>
          </form>
        </Modal>
      </>
    );
  }

  const u = access.user;
  const currentRole = (u.roleKey ?? "user") as CrewAccessRoleKey;
  const canSwapRole =
    canManage &&
    (u.roleKey === "user" ||
      u.roleKey === "colaborador" ||
      u.roleKey === null);

  return (
    <>
      <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--color-nachipa-title)]">
              Acceso al portal
            </h2>
            <p className="mt-1 text-[13px] text-[var(--color-nachipa-secondary)]">
              {access.scopeSummary ?? "Cuenta vinculada"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {access.invitePending ? (
              <span className="inline-flex rounded-full bg-[var(--color-status-warning-bg,#ffedd5)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--color-status-warning-fg,#c2410c)]">
                Invitación pendiente
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-[var(--color-status-success-bg)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--color-status-success-fg)]">
                Activo
              </span>
            )}
            {!u.state ? (
              <span className="inline-flex rounded-full bg-[var(--color-status-danger-bg)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--color-status-danger-fg)]">
                Usuario desactivado
              </span>
            ) : null}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-[var(--color-nachipa-secondary)]">
              Correo
            </dt>
            <dd className="mt-0.5 text-[13px] text-[var(--color-nachipa-title)]">
              {u.email}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--color-nachipa-secondary)]">
              Usuario
            </dt>
            <dd className="mt-0.5 text-[13px] text-[var(--color-nachipa-title)]">
              {u.username}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--color-nachipa-secondary)]">
              Rol
            </dt>
            <dd className="mt-0.5 text-[13px] text-[var(--color-nachipa-title)]">
              {u.roleName ?? u.internalRol}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--color-nachipa-secondary)]">
              Alcance
            </dt>
            <dd className="mt-0.5 text-[13px] text-[var(--color-nachipa-title)]">
              {u.locationName ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--color-nachipa-secondary)]">
              Último ingreso
            </dt>
            <dd className="mt-0.5 text-[13px] text-[var(--color-nachipa-title)]">
              {formatLastLogin(u.lastLoginAt)}
            </dd>
          </div>
        </dl>

        {canSwapRole ? (
          <div className="mt-5 max-w-xs">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Cambiar rol
              </span>
              <select
                className={selectClass}
                value={currentRole === "colaborador" ? "colaborador" : "user"}
                disabled={busy}
                onChange={(e) => {
                  void onChangeRole(e.target.value as CrewAccessRoleKey);
                }}
              >
                <option value="user">User (tripulante de nave)</option>
                <option value="colaborador">
                  Colaborador (capitán / supervisor)
                </option>
              </select>
            </label>
            <p className="mt-1.5 text-[12px] text-[var(--color-nachipa-secondary)]">
              Colaborador puede validar certificados y recibir permisos de
              trabajo a bordo.
            </p>
          </div>
        ) : null}

        {canManage ? (
          <div className="mt-6 border-t border-[var(--color-tremor-border)] pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => setRevokeOpen(true)}
              className="inline-flex h-[30px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[12px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
            >
              <Link2Off className="size-3.5" strokeWidth={1.5} aria-hidden />
              Quitar acceso
            </button>
            <p className="mt-2 text-[12px] text-[var(--color-nachipa-secondary)]">
              Desvincula la cuenta de este tripulante. No elimina el usuario ni
              sus datos.
            </p>
          </div>
        ) : null}
      </div>

      <Modal
        open={revokeOpen}
        onClose={() => {
          if (!busy) setRevokeOpen(false);
        }}
        icon={Link2Off}
        title="Quitar acceso"
        subtitle={`¿Desvincular la cuenta de ${crewDisplayName}? Podrá volver a otorgarse después.`}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setRevokeOpen(false)}
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={busy}
              onClick={() => {
                void onRevoke();
              }}
            >
              {busy ? "Quitando…" : "Quitar acceso"}
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-[var(--color-nachipa-secondary)]">
          La cuenta de usuario se conserva; solo se quita el vínculo con este
          tripulante.
        </p>
      </Modal>
    </>
  );
}
