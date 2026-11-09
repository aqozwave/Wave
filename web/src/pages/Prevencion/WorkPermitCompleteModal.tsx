import { useEffect, useState } from "react";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  listContractorPeopleRequest,
  listContractorPortalPeopleRequest,
  type ContractorPerson,
} from "../../lib/api/contractors";
import {
  getWorkPermitChecklistRequest,
  listWorkPermitPeopleRequest,
  putWorkPermitChecklistRequest,
  putWorkPermitPeopleRequest,
  submitWorkPermitRequest,
  type WorkPermit,
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
  /** Portal contratista usa /me/people; staff usa /contractors/:orgId/people. */
  mode: "portal" | "staff";
  onClose: () => void;
  /** Tras guardar o enviar. */
  onDone: () => void;
};

/**
 * Modal para completar personal + checklist (E12 / E12b) y enviar (E13).
 * Usable desde portal contratista y bandeja Prevención (opción B).
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState<ContractorPerson[]>([]);
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
        const [peopleRes, assignedRes, checklistRes] = await Promise.all([
          mode === "portal"
            ? listContractorPortalPeopleRequest(accessToken, {
                limit: 100,
                active: true,
              })
            : listContractorPeopleRequest(
                accessToken,
                permit!.organizationId,
                1,
                100,
                { active: true },
              ),
          listWorkPermitPeopleRequest(accessToken, permit!.id),
          getWorkPermitChecklistRequest(accessToken, permit!.id, "contractor"),
        ]);
        if (cancelled) return;
        setAvailable(peopleRes.items);
        setSelectedIds(new Set(assignedRes.items.map((p) => p.personId)));
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
  }, [open, permit, accessToken, mode, showToast]);

  /** Marca/desmarca persona. */
  function togglePerson(personId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
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
            {available.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                No hay personas activas en la organización.
              </p>
            ) : (
              <ul className="m-0 flex max-h-48 list-none flex-col gap-1 overflow-y-auto p-0">
                {available.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] px-2 py-1.5 hover:bg-[var(--color-nachipa-bg-page)]">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedIds.has(p.id)}
                        onChange={() => togglePerson(p.id)}
                      />
                      <span>
                        <span className="block text-[13px] font-medium text-[var(--color-nachipa-title)]">
                          {p.fullName}
                        </span>
                        <span className="text-[12px] tabular-nums text-[var(--color-nachipa-secondary)]">
                          {p.rut}
                          {p.position ? ` · ${p.position}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
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
