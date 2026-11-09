import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Link, useParams } from "react-router";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TextField } from "../../components/TextField/TextField";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import { userHasPermission } from "../../lib/api/auth";
import {
  approveWorkPermitRequest,
  getWorkPermitChecklistRequest,
  getWorkPermitRequest,
  listWorkPermitHistoryRequest,
  listWorkPermitPeopleRequest,
  receiveWorkPermitRequest,
  rejectReceiptWorkPermitRequest,
  returnWorkPermitRequest,
  workPermitStatusLabel,
  type WorkPermit,
  type WorkPermitChecklistItem,
  type WorkPermitHistoryItem,
  type WorkPermitPerson,
  type WorkPermitStatus,
} from "../../lib/api/workPermits";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { WorkPermitCompleteModal } from "./WorkPermitCompleteModal";

/** Tabs de la ficha (P6 / P6d / P6e / P6f). */
type TabId = "datos" | "personal" | "checklist" | "historial";

/** Capitaliza. */
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

/** Fecha+hora corta es-CL. */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tono chip de estado. */
function statusTone(
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
    default:
      return "neutral";
  }
}

/** Etiqueta Sí/No/N/A. */
function answerLabel(answer: string | null): string {
  if (answer === "yes") return "Sí";
  if (answer === "no") return "No";
  if (answer === "na") return "N/A";
  return "Sin responder";
}

const outlineBtnClass =
  "inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/**
 * Ficha de revisión del permiso (P5e1 · P6*).
 * Tabs: datos, personal, checklist, historial + acciones según estado.
 */
export function WorkPermitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const canRead = userHasPermission(user, "work_permits", "read");
  const canUpdate = userHasPermission(user, "work_permits", "update");
  const canReceive = userHasPermission(user, "work_permits", "receive");
  const isStaff = !user?.organizationId;

  const [tab, setTab] = useState<TabId>("datos");
  const [permit, setPermit] = useState<WorkPermit | null>(null);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<WorkPermitPerson[]>([]);
  const [checklist, setChecklist] = useState<WorkPermitChecklistItem[]>([]);
  const [history, setHistory] = useState<WorkPermitHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [tabLoading, setTabLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [noteModal, setNoteModal] = useState<"return" | "reject-receipt" | null>(
    null,
  );
  const [reviewNote, setReviewNote] = useState("");

  const loadPermit = useCallback(async () => {
    if (!accessToken || !id || !canRead) return;
    setLoading(true);
    try {
      const row = await getWorkPermitRequest(accessToken, id);
      setPermit(row);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cargar el permiso",
        "danger",
      );
      setPermit(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, canRead, showToast]);

  useEffect(() => {
    void loadPermit();
  }, [loadPermit]);

  /** Carga datos del tab activo. */
  useEffect(() => {
    if (!accessToken || !id || !permit) return;
    let cancelled = false;

    async function loadTab() {
      setTabLoading(true);
      try {
        if (tab === "personal") {
          const res = await listWorkPermitPeopleRequest(accessToken!, id!);
          if (!cancelled) setPeople(res.items);
        } else if (tab === "checklist") {
          const res = await getWorkPermitChecklistRequest(
            accessToken!,
            id!,
            "contractor",
          );
          if (!cancelled) setChecklist(res.items);
        } else if (tab === "historial") {
          const res = await listWorkPermitHistoryRequest(
            accessToken!,
            id!,
            1,
            50,
          );
          if (!cancelled) {
            setHistory(res.items);
            setHistoryTotal(res.total);
          }
        }
      } catch (err) {
        if (!cancelled) {
          showToast(
            err instanceof ApiError ? err.message : "No se pudo cargar la pestaña",
            "danger",
          );
        }
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    }

    if (tab !== "datos") void loadTab();
    return () => {
      cancelled = true;
    };
  }, [tab, accessToken, id, permit, showToast]);

  async function onApprove() {
    if (!accessToken || !permit || acting) return;
    setActing(true);
    try {
      const updated = await approveWorkPermitRequest(accessToken, permit.id);
      setPermit(updated);
      showToast(
        `${updated.code} · ${workPermitStatusLabel("to_receive")}.`,
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo aprobar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  async function onReceive() {
    if (!accessToken || !permit || acting) return;
    setActing(true);
    try {
      const updated = await receiveWorkPermitRequest(accessToken, permit.id);
      setPermit(updated);
      showToast(
        `${updated.code} · ${workPermitStatusLabel("active")}.`,
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo recibir.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  async function confirmNote() {
    if (!accessToken || !permit || !noteModal || !reviewNote.trim() || acting) {
      return;
    }
    setActing(true);
    try {
      const updated =
        noteModal === "return"
          ? await returnWorkPermitRequest(
              accessToken,
              permit.id,
              reviewNote.trim(),
            )
          : await rejectReceiptWorkPermitRequest(
              accessToken,
              permit.id,
              reviewNote.trim(),
            );
      setPermit(updated);
      showToast(
        noteModal === "return"
          ? `${updated.code} · ${workPermitStatusLabel("to_complete")}.`
          : `${updated.code} · vuelve a ${workPermitStatusLabel("to_approve")}.`,
        "success",
      );
      setNoteModal(null);
      setReviewNote("");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "datos", label: "Datos" },
    { id: "personal", label: "Personal" },
    { id: "checklist", label: "Checklist" },
    { id: "historial", label: "Historial" },
  ];

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Prevención"
          breadcrumbIcon={ClipboardCheck}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            No tenés permiso work_permits.read.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Prevención"
        breadcrumbIcon={ClipboardCheck}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Permisos de trabajo", to: "/prevencion/permisos" },
            { label: permit?.code ?? "…" },
          ]}
          title={
            permit
              ? `${permit.code} · ${permit.permitType.name}`
              : loading
                ? "Cargando…"
                : "Permiso"
          }
          description={
            permit
              ? `${displayName(permit.organization.name)} · ${displayName(permit.location.name)}`
              : undefined
          }
          actions={
            permit ? (
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone={statusTone(permit.status)}>
                  {workPermitStatusLabel(permit.status)}
                </StatusChip>
                {canUpdate && permit.status === "to_complete" ? (
                  <Button
                    type="button"
                    size="medium"
                    className="!w-auto"
                    onClick={() => setCompleteOpen(true)}
                  >
                    Completar
                  </Button>
                ) : null}
                {canUpdate && isStaff && permit.status === "to_approve" ? (
                  <>
                    <Button
                      type="button"
                      size="medium"
                      className="!w-auto"
                      disabled={acting}
                      onClick={() => void onApprove()}
                    >
                      Aprobar
                    </Button>
                    <button
                      type="button"
                      className={outlineBtnClass}
                      disabled={acting}
                      onClick={() => {
                        setReviewNote("");
                        setNoteModal("return");
                      }}
                    >
                      Devolver
                    </button>
                  </>
                ) : null}
                {canReceive && isStaff && permit.status === "to_receive" ? (
                  <>
                    <Button
                      type="button"
                      size="medium"
                      className="!w-auto"
                      disabled={acting}
                      onClick={() => void onReceive()}
                    >
                      Autorizar a bordo
                    </Button>
                    <button
                      type="button"
                      className={outlineBtnClass}
                      disabled={acting}
                      onClick={() => {
                        setReviewNote("");
                        setNoteModal("reject-receipt");
                      }}
                    >
                      No autorizar
                    </button>
                  </>
                ) : null}
              </div>
            ) : undefined
          }
        />

        <div className="flex gap-1 border-b border-[var(--color-tremor-border)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "border-b-2 border-[var(--color-nachipa-primary)] px-3 py-2 text-[13px] font-semibold text-[var(--color-nachipa-title)]"
                  : "px-3 py-2 text-[13px] font-medium text-[var(--color-nachipa-secondary)] hover:text-[var(--color-nachipa-title)]"
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {!permit && loading ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando…
          </p>
        ) : !permit ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Permiso no encontrado.{" "}
            <Link
              to="/prevencion/permisos"
              className="text-[var(--color-nachipa-primary)] hover:underline"
            >
              Volver al listado
            </Link>
          </p>
        ) : tab === "datos" ? (
          <div className="grid max-w-3xl gap-3 rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-4 text-[13px]">
            <Row label="Código" value={permit.code} />
            <Row label="Aviso" value={permit.workNotice.code} />
            <Row
              label="Empresa"
              value={`${displayName(permit.organization.name)} · ${permit.organization.rut}`}
            />
            <Row
              label="Tipo"
              value={`${permit.permitType.code} · ${permit.permitType.name}`}
            />
            <Row label="Nave" value={displayName(permit.location.name)} />
            <Row label="Fecha" value={formatDate(permit.scheduledDate)} />
            <Row
              label="Estado"
              value={workPermitStatusLabel(permit.status)}
            />
            <Row
              label="Descripción"
              value={permit.description?.trim() || "—"}
            />
            {permit.reviewNote ? (
              <Row label="Última observación" value={permit.reviewNote} />
            ) : null}
            <Row
              label="Actualizado"
              value={formatDateTime(permit.updatedAt)}
            />
          </div>
        ) : tab === "personal" ? (
          tabLoading ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Cargando…
            </p>
          ) : people.length === 0 ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Todavía no hay personal asignado.
            </p>
          ) : (
            <table className="w-full max-w-3xl border-collapse text-left text-[13px]">
              <thead>
                <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] text-[var(--color-nachipa-secondary)]">
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">RUN</th>
                  <th className="px-3 py-2">Cargo</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr
                    key={p.personId}
                    className="border-t border-[var(--color-tremor-border)]"
                  >
                    <td className="px-3 py-2 font-medium text-[var(--color-nachipa-title)]">
                      {p.fullName}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{p.rut}</td>
                    <td className="px-3 py-2">{p.position ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : tab === "checklist" ? (
          tabLoading ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Cargando…
            </p>
          ) : checklist.length === 0 ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Este tipo no tiene ítems de checklist activos.
            </p>
          ) : (
            <ul className="m-0 flex max-w-3xl list-none flex-col gap-2 p-0">
              {checklist.map((item) => (
                <li
                  key={item.checklistItemId}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 py-2 text-[13px]"
                >
                  <span>
                    {item.order}. {item.text}
                  </span>
                  <StatusChip
                    tone={item.answer ? "success" : "warning"}
                  >
                    {answerLabel(item.answer)}
                  </StatusChip>
                </li>
              ))}
            </ul>
          )
        ) : tabLoading ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando…
          </p>
        ) : history.length === 0 ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Sin eventos todavía.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
              {historyTotal}{" "}
              {historyTotal === 1 ? "evento" : "eventos"}
            </p>
            <table className="w-full max-w-4xl border-collapse text-left text-[13px]">
              <thead>
                <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] text-[var(--color-nachipa-secondary)]">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-t border-[var(--color-tremor-border)]"
                  >
                    <td className="px-3 py-2 tabular-nums text-[var(--color-nachipa-body)]">
                      {formatDateTime(ev.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-[var(--color-nachipa-title)]">
                        {ev.event}
                      </span>
                      {ev.detail ? (
                        <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                          {ev.detail}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-nachipa-body)]">
                      {ev.user ?? "—"}
                      {ev.role ? (
                        <span className="block text-[12px] text-[var(--color-nachipa-secondary)]">
                          {ev.role}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <StatusChip tone={ev.resultTone}>{ev.result}</StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {accessToken && permit ? (
        <WorkPermitCompleteModal
          open={completeOpen}
          permit={permit}
          accessToken={accessToken}
          mode={user?.organizationId ? "portal" : "staff"}
          onClose={() => setCompleteOpen(false)}
          onDone={() => {
            void loadPermit();
            setTab("datos");
          }}
        />
      ) : null}

      <Modal
        open={Boolean(noteModal)}
        onClose={() => {
          if (!acting) setNoteModal(null);
        }}
        title={
          noteModal === "reject-receipt"
            ? "No autorizar recepción"
            : "Devolver permiso al contratista"
        }
        subtitle={permit ? permit.code : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => setNoteModal(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={acting || !reviewNote.trim()}
              onClick={() => void confirmNote()}
            >
              {acting
                ? "Guardando…"
                : noteModal === "reject-receipt"
                  ? "No autorizar"
                  : "Devolver"}
            </Button>
          </div>
        }
      >
        <p className="m-0 mb-3 text-[13px] text-[var(--color-nachipa-secondary)]">
          {noteModal === "reject-receipt"
            ? "El permiso vuelve a «En revisión» con tu motivo."
            : "El permiso vuelve a «Por completar» con tu observación."}
        </p>
        <TextField
          label={noteModal === "reject-receipt" ? "Motivo" : "Observaciones"}
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          required
        />
      </Modal>
    </div>
  );
}

/** Fila dato etiqueta / valor. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[160px_1fr] sm:gap-3">
      <span className="text-[var(--color-nachipa-secondary)]">{label}</span>
      <span className="text-[var(--color-nachipa-title)]">{value}</span>
    </div>
  );
}
