import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  getWorkPermitChecklistRequest,
  listWorkPermitAssignablePeopleRequest,
  listWorkPermitPeopleRequest,
  putWorkPermitChecklistRequest,
  putWorkPermitPeopleRequest,
  submitWorkPermitRequest,
  type WorkPermit,
  type WorkPermitAssignablePerson,
  type WorkPermitChecklistAnswerValue,
  type WorkPermitChecklistItem,
} from "../../lib/api/workPermits";
import { ApiError } from "../../lib/auth/AuthContext";

/** Botón outline del footer. */
const outlineBtnClass =
  "inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/**
 * Cumple todo lo exigido por este PT (pack + faena del tipo).
 * Distinto de canAssign (solo pack): se puede asignar sin cumplir faena aún.
 */
function personMeetsJob(person: WorkPermitAssignablePerson): boolean {
  return (
    person.packComplete &&
    person.missingRequirementLabels.length === 0 &&
    person.pendingRequirementLabels.length === 0 &&
    person.absentRequirementLabels.length === 0
  );
}

type Props = {
  open: boolean;
  permit: WorkPermit | null;
  accessToken: string;
  /** Portal contratista o staff Prevención (misma API de readiness). */
  mode: "portal" | "staff";
  onClose: () => void;
  /** Tras guardar o enviar. */
  onDone: () => void;
};

/**
 * Modal para completar personal + checklist (E12 / E12b) y enviar (E13).
 * Muestra pack y exigencias de faena faltantes por persona antes de guardar.
 */
export function WorkPermitCompleteModal({
  open,
  permit,
  accessToken,
  mode,
  onClose,
  onDone,
}: Props) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState<WorkPermitAssignablePerson[]>([]);
  const [requirementLabels, setRequirementLabels] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [checklist, setChecklist] = useState<WorkPermitChecklistItem[]>([]);
  const [answers, setAnswers] = useState<
    Record<string, WorkPermitChecklistAnswerValue>
  >({});

  useEffect(() => {
    if (!open || !permit || !accessToken) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [assignableRes, assignedRes, checklistRes] = await Promise.all([
          listWorkPermitAssignablePeopleRequest(accessToken, permit!.id),
          listWorkPermitPeopleRequest(accessToken, permit!.id),
          getWorkPermitChecklistRequest(accessToken, permit!.id, "contractor"),
        ]);
        if (cancelled) return;
        setAvailable(assignableRes.items);
        setRequirementLabels(assignableRes.personRequirementLabels);
        const assignableIds = new Set(
          assignableRes.items.filter((p) => p.canAssign).map((p) => p.personId),
        );
        setSelectedIds(
          new Set(
            assignedRes.items
              .map((p) => p.personId)
              .filter((id) => assignableIds.has(id)),
          ),
        );
        setChecklist(checklistRes.items);
        const next: Record<string, WorkPermitChecklistAnswerValue> = {};
        for (const item of checklistRes.items) {
          if (item.answer) next[item.checklistItemId] = item.answer;
        }
        setAnswers(next);
      } catch (err) {
        if (!cancelled) {
          showToast(
            err instanceof ApiError
              ? err.message
              : "No se pudo cargar el permiso",
            "danger",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, permit, accessToken, showToast]);

  /** Marca/desmarca persona (solo si canAssign). */
  function togglePerson(person: WorkPermitAssignablePerson) {
    if (!person.canAssign) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(person.personId)) next.delete(person.personId);
      else next.add(person.personId);
      return next;
    });
  }

  /** Texto corto: distingue sin subir vs pendiente de validación. */
  function missingHint(person: WorkPermitAssignablePerson): string {
    const parts: string[] = [];
    if (person.absentPackCodes.length > 0) {
      parts.push(`subir pack: ${person.absentPackCodes.join(", ")}`);
    }
    if (person.pendingPackCodes.length > 0) {
      parts.push(
        `pack en revisión Prevención: ${person.pendingPackCodes.join(", ")}`,
      );
    }
    if (person.absentRequirementLabels.length > 0) {
      parts.push(`subir faena: ${person.absentRequirementLabels.join(", ")}`);
    }
    if (person.pendingRequirementLabels.length > 0) {
      parts.push(
        `faena en revisión: ${person.pendingRequirementLabels.join(", ")}`,
      );
    }
    return parts.join(" · ");
  }

  /** Guarda personal + checklist; opcionalmente envía a aprobación. */
  async function save(andSubmit: boolean) {
    if (!permit || !accessToken || saving) return;
    setSaving(true);
    try {
      await putWorkPermitPeopleRequest(accessToken, permit.id, [
        ...selectedIds,
      ]);
      const answerRows = checklist
        .filter((item) => answers[item.checklistItemId])
        .map((item) => ({
          checklistItemId: item.checklistItemId,
          answer: answers[item.checklistItemId]!,
        }));
      if (answerRows.length > 0) {
        await putWorkPermitChecklistRequest(
          accessToken,
          permit.id,
          answerRows,
          "contractor",
        );
      }
      if (andSubmit) {
        await submitWorkPermitRequest(accessToken, permit.id);
        showToast(`${permit.code} enviado a revisión.`, "success");
      } else {
        showToast(`${permit.code} guardado.`, "success");
      }
      onDone();
      onClose();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setSaving(false);
    }
  }

  /**
   * Asigna a la persona (para desbloquear tipos de faena) y lleva a cargar docs.
   * Portal → Personal; staff → ficha del contratista.
   */
  async function goUploadMissing(person: WorkPermitAssignablePerson) {
    if (!permit || !accessToken || saving || !person.canAssign) return;
    setSaving(true);
    try {
      const nextIds = new Set(selectedIds);
      nextIds.add(person.personId);
      await putWorkPermitPeopleRequest(accessToken, permit.id, [...nextIds]);
      setSelectedIds(nextIds);
      showToast(
        "Personal guardado. Cargá los documentos faltantes y volvé a Completar.",
        "info",
      );
      onDone();
      onClose();
      if (mode === "portal") {
        navigate("/portal/personal");
      } else {
        navigate(`/prevencion/contratistas/${permit.organizationId}`);
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo asignar la persona.",
        "danger",
      );
    } finally {
      setSaving(false);
    }
  }

  const allAnswered =
    checklist.length === 0 ||
    checklist.every((item) => Boolean(answers[item.checklistItemId]));
  const selectedPeople = available.filter((p) => selectedIds.has(p.personId));
  const allSelectedMeetJob =
    selectedPeople.length > 0 && selectedPeople.every(personMeetsJob);
  /** Enviar solo con personal Cumple + checklist completo. */
  const canSubmit =
    selectedIds.size >= 1 && allAnswered && allSelectedMeetJob;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Completar permiso"
      subtitle={
        permit
          ? `${permit.code} · ${permit.permitType.code} · ${permit.location.name}`
          : undefined
      }
      maxWidthClass="max-w-[720px]"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className={outlineBtnClass}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save(false)}
            className={outlineBtnClass}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <Button
            type="button"
            size="medium"
            className="!w-auto"
            disabled={saving || loading || !canSubmit}
            onClick={() => void save(true)}
          >
            {saving ? "Enviando…" : "Enviar a aprobación"}
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
          Cargando…
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {permit?.reviewNote ? (
            <p className="m-0 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page)] px-3 py-2 text-[13px] text-[var(--color-nachipa-title)]">
              Observación de Prevención: {permit.reviewNote}
            </p>
          ) : null}

          <section>
            <h3 className="m-0 mb-2 text-[13px] font-semibold text-[var(--color-nachipa-title)]">
              Personal ({selectedIds.size})
            </h3>
            <p className="m-0 mb-2 text-[12px] text-[var(--color-nachipa-secondary)]">
              Badge «Cumple» = pack + docs/capacitaciones de esta faena
              {requirementLabels.length > 0
                ? ` (${requirementLabels.join(", ")})`
                : ""}{" "}
              validados. Podés asignar con pack OK; para enviar a revisión todos
              los seleccionados deben estar en Cumple (cargá los faltantes
              antes).
            </p>
            {available.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                No hay personas activas en la organización.
              </p>
            ) : (
              <ul className="m-0 flex max-h-72 list-none flex-col gap-1 overflow-y-auto p-0">
                {available.map((p) => {
                  const hint = missingHint(p);
                  const cumple = personMeetsJob(p);
                  const selected = selectedIds.has(p.personId);
                  return (
                    <li key={p.personId}>
                      <div
                        className={`flex items-start gap-2 rounded-[var(--radius-md)] px-2 py-1.5 ${
                          p.canAssign
                            ? "hover:bg-[var(--color-nachipa-bg-page)]"
                            : "opacity-60"
                        }`}
                      >
                        <label
                          className={`flex min-w-0 flex-1 items-start gap-2 ${
                            p.canAssign
                              ? "cursor-pointer"
                              : "cursor-not-allowed"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selected}
                            disabled={!p.canAssign}
                            onChange={() => togglePerson(p)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                                {p.fullName}
                              </span>
                              <StatusChip
                                tone={cumple ? "success" : "warning"}
                              >
                                {cumple ? "Cumple" : "No cumple"}
                              </StatusChip>
                            </span>
                            <span className="mt-0.5 block text-[12px] tabular-nums text-[var(--color-nachipa-secondary)]">
                              {p.rut}
                              {p.position ? ` · ${p.position}` : ""}
                              {!p.canAssign
                                ? hint
                                  ? ` · ${hint}`
                                  : " · Sin pack"
                                : !cumple && hint
                                  ? ` · ${hint}`
                                  : cumple
                                    ? " · Listo para enviar"
                                    : ""}
                            </span>
                          </span>
                        </label>
                        {p.canAssign && !cumple ? (
                          <button
                            type="button"
                            disabled={saving}
                            className="shrink-0 self-center text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-60"
                            onClick={() => void goUploadMissing(p)}
                          >
                            Cargar faltantes
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="m-0 mb-2 text-[13px] font-semibold text-[var(--color-nachipa-title)]">
              Checklist
            </h3>
            {checklist.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Este tipo no tiene ítems de checklist activos.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {checklist.map((item) => (
                  <li
                    key={item.checklistItemId}
                    className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-[13px] text-[var(--color-nachipa-body)]">
                      {item.order}. {item.text}
                    </span>
                    <select
                      className="h-8 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2 text-[13px]"
                      value={answers[item.checklistItemId] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value as
                          | WorkPermitChecklistAnswerValue
                          | "";
                        setAnswers((prev) => {
                          const next = { ...prev };
                          if (!v) delete next[item.checklistItemId];
                          else next[item.checklistItemId] = v;
                          return next;
                        });
                      }}
                    >
                      <option value="">Sin responder</option>
                      <option value="yes">Sí</option>
                      <option value="no">No</option>
                      <option value="na">N/A</option>
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
