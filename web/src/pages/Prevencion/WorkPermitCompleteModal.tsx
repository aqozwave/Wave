import { useEffect, useState } from "react";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
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
  mode: _mode,
  onClose,
  onDone,
}: Props) {
  const { showToast } = useToast();
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

  const allAnswered =
    checklist.length === 0 ||
    checklist.every((item) => Boolean(answers[item.checklistItemId]));
  const canSubmit = selectedIds.size >= 1 && allAnswered;

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
              Solo personal con pack
              {requirementLabels.length > 0
                ? ` y docs de faena (${requirementLabels.join(", ")})`
                : ""}{" "}
              validados por Prevención. Subir el archivo no alcanza: tienen que
              estar vigentes.
            </p>
            {available.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                No hay personas activas en la organización.
              </p>
            ) : (
              <ul className="m-0 flex max-h-56 list-none flex-col gap-1 overflow-y-auto p-0">
                {available.map((p) => {
                  const hint = missingHint(p);
                  return (
                    <li key={p.personId}>
                      <label
                        className={`flex items-start gap-2 rounded-[var(--radius-md)] px-2 py-1.5 ${
                          p.canAssign
                            ? "cursor-pointer hover:bg-[var(--color-nachipa-bg-page)]"
                            : "cursor-not-allowed opacity-60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedIds.has(p.personId)}
                          disabled={!p.canAssign}
                          onChange={() => togglePerson(p)}
                        />
                        <span>
                          <span className="block text-[13px] font-medium text-[var(--color-nachipa-title)]">
                            {p.fullName}
                          </span>
                          <span className="text-[12px] tabular-nums text-[var(--color-nachipa-secondary)]">
                            {p.rut}
                            {p.position ? ` · ${p.position}` : ""}
                            {p.canAssign ? " · Listo" : hint ? ` · Falta ${hint}` : " · No asignable"}
                          </span>
                        </span>
                      </label>
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
