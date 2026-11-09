import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  listWorkNoticesRequest,
  type WorkNotice,
} from "../../lib/api/workNotices";
import {
  checkWorkPermitRequirementsRequest,
  createWorkPermitRequest,
  type WorkPermitRequirementCheckItem,
  type WorkPermitRequirementCheckStatus,
  type WorkPermitRequirementsCheck,
} from "../../lib/api/workPermits";
import { ApiError } from "../../lib/auth/AuthContext";

/** Botón outline del footer. */
const outlineBtnClass =
  "inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

type Props = {
  open: boolean;
  accessToken: string;
  /** Si viene de Avisos, salta al paso 2 con ese aviso. */
  initialNotice?: WorkNotice | null;
  onClose: () => void;
  /** Tras crear el PT. */
  onCreated: (permitId: string) => void;
};

/** Capitaliza nombre visible. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** dd-mm-yyyy. */
function formatDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

/** Etiqueta de estado P13b. */
function checkStatusLabel(status: WorkPermitRequirementCheckStatus): string {
  switch (status) {
    case "ok":
      return "Cumple";
    case "later":
      return "Después";
    case "missing":
      return "Falta";
    case "not_applicable":
      return "No aplica";
    default:
      return status;
  }
}

/** Tono del chip de verificación. */
function checkStatusTone(
  status: WorkPermitRequirementCheckStatus,
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "ok":
      return "success";
    case "later":
      return "info";
    case "missing":
      return "danger";
    case "not_applicable":
      return "neutral";
    default:
      return "neutral";
  }
}

/** Texto corto de scope/momento. */
function scopeLabel(scope: WorkPermitRequirementCheckItem["scope"]): string {
  switch (scope) {
    case "company":
      return "Empresa";
    case "person":
      return "Cada persona";
    case "permit":
      return "Permiso";
    default:
      return scope;
  }
}

/** Momento legible. */
function momentLabel(moment: WorkPermitRequirementCheckItem["moment"]): string {
  return moment === "closure" ? "Cierre" : "Antes";
}

/**
 * Modal Nuevo permiso (P13 / P13b).
 * Paso 1: elegir aviso pending. Paso 2: verificación + crear.
 */
export function WorkPermitCreateModal({
  open,
  accessToken,
  initialNotice = null,
  onClose,
  onCreated,
}: Props) {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [notices, setNotices] = useState<WorkNotice[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(false);
  const [selected, setSelected] = useState<WorkNotice | null>(null);
  const [check, setCheck] = useState<WorkPermitRequirementsCheck | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [creating, setCreating] = useState(false);

  /** Al abrir: reset o salta al paso 2 si hay aviso inicial. */
  useEffect(() => {
    if (!open) return;
    setCreating(false);
    setCheck(null);
    if (initialNotice) {
      setSelected(initialNotice);
      setStep(2);
      setNotices([]);
      return;
    }
    setSelected(null);
    setStep(1);
    let cancelled = false;
    async function load() {
      setLoadingNotices(true);
      try {
        const result = await listWorkNoticesRequest(accessToken, 1, 100, {
          status: "pending",
        });
        if (cancelled) return;
        setNotices(result.items.filter((n) => !n.workPermit));
      } catch (err) {
        if (!cancelled) {
          showToast(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar avisos",
            "danger",
          );
        }
      } finally {
        if (!cancelled) setLoadingNotices(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, accessToken, initialNotice, showToast]);

  /** Paso 2: corre requirements-check. */
  useEffect(() => {
    if (!open || step !== 2 || !selected) return;
    let cancelled = false;
    async function loadCheck() {
      setLoadingCheck(true);
      setCheck(null);
      try {
        const result = await checkWorkPermitRequirementsRequest(
          accessToken,
          selected!.organizationId,
          selected!.permitTypeId,
        );
        if (!cancelled) setCheck(result);
      } catch (err) {
        if (!cancelled) {
          showToast(
            err instanceof ApiError
              ? err.message
              : "No se pudo verificar exigencias",
            "danger",
          );
        }
      } finally {
        if (!cancelled) setLoadingCheck(false);
      }
    }
    void loadCheck();
    return () => {
      cancelled = true;
    };
  }, [open, step, selected, accessToken, showToast]);

  const subtitle = useMemo(() => {
    if (!selected) return "Paso 1 de 2 · Elegí el aviso";
    return `${displayName(selected.organization.name)} · ${displayName(selected.location.name)} · ${formatDate(selected.tentativeDate)} · ${selected.permitType.name}`;
  }, [selected]);

  /** Avanza al paso de verificación. */
  function goToCheck(notice: WorkNotice) {
    setSelected(notice);
    setStep(2);
  }

  /** Vuelve al listado de avisos (solo si no vino preseleccionado). */
  function goBack() {
    if (initialNotice || creating) return;
    setStep(1);
    setCheck(null);
  }

  /** Crea el PT y notifica al padre. */
  async function onCreate() {
    if (!selected || !check?.canCreate || creating) return;
    setCreating(true);
    try {
      const permit = await createWorkPermitRequest(accessToken, {
        workNoticeId: selected.id,
      });
      showToast(
        `Permiso ${permit.code} creado · Por completar.`,
        "success",
      );
      onCreated(permit.id);
      onClose();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo crear el permiso.",
        "danger",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!creating) onClose();
      }}
      title={
        selected
          ? `Nuevo permiso · ${selected.permitType.name}`
          : "Nuevo permiso de trabajo"
      }
      subtitle={subtitle}
      maxWidthClass="max-w-[820px]"
      footer={
        <div className="flex justify-between gap-2">
          <div>
            {step === 2 && !initialNotice ? (
              <button
                type="button"
                disabled={creating}
                onClick={goBack}
                className={outlineBtnClass}
              >
                Atrás
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={onClose}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            {step === 2 ? (
              <Button
                type="button"
                size="medium"
                className="!w-auto"
                disabled={creating || loadingCheck || !check?.canCreate}
                onClick={() => void onCreate()}
              >
                {creating ? "Creando…" : "Crear y enviar al contratista"}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {step === 1 ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Creás el permiso para una empresa habilitada a partir de un aviso
            pendiente. El contratista lo completa; vos lo aprobás y el capitán
            lo recibe a bordo.
          </p>
          {loadingNotices ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Cargando avisos…
            </p>
          ) : notices.length === 0 ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              No hay avisos pendientes sin permiso. Creá un aviso primero.
            </p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-tremor-border)]">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
                    <th className="px-3 py-2">Aviso</th>
                    <th className="px-3 py-2">Empresa</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Lugar</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {notices.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--color-tremor-border)]"
                    >
                      <td className="px-3 py-2 font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                        {row.code}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-nachipa-body)]">
                        {displayName(row.organization.name)}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-nachipa-body)]">
                        {row.permitType.code}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-nachipa-body)]">
                        {displayName(row.location.name)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-[var(--color-nachipa-body)]">
                        {formatDate(row.tentativeDate)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                          onClick={() => goToCheck(row)}
                        >
                          Continuar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {selected ? (
            <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
              Aviso {selected.code}
              {check?.accreditation
                ? ` · HAB ${check.accreditation.code} · ${check.accreditation.status}`
                : " · Sin habilitación"}
            </p>
          ) : null}

          {loadingCheck ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Verificando exigencias…
            </p>
          ) : check ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryCard label="Cumple" value={check.summary.ok} tone="success" />
                <SummaryCard
                  label="Después"
                  value={check.summary.later}
                  tone="info"
                />
                <SummaryCard
                  label="Falta"
                  value={check.summary.missing}
                  tone="danger"
                />
                <SummaryCard
                  label="No aplica"
                  value={check.summary.notApplicable}
                  tone="neutral"
                />
              </div>

              {!check.canCreate ? (
                <p className="m-0 rounded-[var(--radius-md)] border border-[var(--color-status-danger-border,#fecaca)] bg-[var(--color-status-danger-bg,#fef2f2)] px-3 py-2 text-[13px] text-[var(--color-nachipa-title)]">
                  {check.accreditation &&
                  check.accreditation.status !== "approved"
                    ? `No se puede crear: la HAB ${check.accreditation.code} sigue en «${check.accreditation.status}». Validar documentos no alcanza — Prevención tiene que Aprobar la habilitación.`
                    : "No se puede crear: la empresa debe tener habilitación aprobada y el pack empresa al día. Las exigencias por persona se verifican al asignar personal."}
                </p>
              ) : check.summary.later > 0 ? (
                <p className="m-0 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page)] px-3 py-2 text-[13px] text-[var(--color-nachipa-body)]">
                  Podés crear el permiso. Las exigencias marcadas «Después»
                  (personal / checklist) se validan al completar y enviar.
                </p>
              ) : null}

              <div className="max-h-[320px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-tremor-border)]">
                <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
                      <th className="px-3 py-2">Exigencia</th>
                      <th className="px-3 py-2">Aplica a</th>
                      <th className="px-3 py-2">Momento</th>
                      <th className="px-3 py-2">Verificación</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.items.map((item) => (
                      <tr
                        key={item.requirementId}
                        className="border-t border-[var(--color-tremor-border)]"
                      >
                        <td className="px-3 py-2 text-[var(--color-nachipa-title)]">
                          {item.label}
                        </td>
                        <td className="px-3 py-2 text-[var(--color-nachipa-body)]">
                          {scopeLabel(item.scope)}
                        </td>
                        <td className="px-3 py-2 text-[var(--color-nachipa-body)]">
                          {momentLabel(item.moment)}
                        </td>
                        <td className="px-3 py-2 text-[var(--color-nachipa-secondary)]">
                          {item.detail ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <StatusChip tone={checkStatusTone(item.status)}>
                            {checkStatusLabel(item.status)}
                          </StatusChip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Sin datos de verificación.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Tarjeta resumen del check (P13b). */
function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "info" | "danger" | "neutral";
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 py-2">
      <div className="text-[12px] text-[var(--color-nachipa-secondary)]">
        {label}
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="text-[20px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
          {value}
        </span>
        <StatusChip tone={tone}>{label}</StatusChip>
      </div>
    </div>
  );
}
