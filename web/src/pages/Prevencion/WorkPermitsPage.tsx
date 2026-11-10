import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { WorkPermitProgressCell } from "../../components/WorkPermitProgressCell/WorkPermitProgressCell";
import {
  WorkPermitSignModal,
  type WorkPermitSignKind,
} from "../../components/WorkPermitSignModal/WorkPermitSignModal";
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
import { TextField } from "../../components/TextField/TextField";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import { userHasPermission } from "../../lib/api/auth";
import {
  approveWorkPermitRequest,
  closeWorkPermitRequest,
  deleteWorkPermitRequest,
  listWorkPermitsRequest,
  receiveWorkPermitRequest,
  rejectCloseWorkPermitRequest,
  rejectReceiptWorkPermitRequest,
  requestCloseWorkPermitRequest,
  returnWorkPermitRequest,
  workPermitStatusLabel,
  type WorkPermit,
  type WorkPermitDigitalSignaturePayload,
  type WorkPermitStatus,
} from "../../lib/api/workPermits";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { WorkPermitCompleteModal } from "./WorkPermitCompleteModal";
import { WorkPermitCreateModal } from "./WorkPermitCreateModal";

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

/** Tono chip. */
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
    case "closed":
      return "neutral";
    default:
      return "neutral";
  }
}

/** Botón outline del modal. */
const outlineBtnClass =
  "inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/**
 * Bandeja de permisos de trabajo (Prevención).
 * Crear PT desde aviso; aprobar/devolver desde «Por aprobar».
 */
export function WorkPermitsPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const canRead = userHasPermission(user, "work_permits", "read");
  const canCreate = userHasPermission(user, "work_permits", "create");
  const canUpdate = userHasPermission(user, "work_permits", "update");
  const canReceive = userHasPermission(user, "work_permits", "receive");
  const canDelete = userHasPermission(user, "work_permits", "deactivate");
  /** Portal contratista no aprueba ni recibe. */
  const isStaff = !user?.organizationId;

  const [items, setItems] = useState<WorkPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  /** Modal con nota: devolver / no autorizar (sin pad). */
  const [noteModal, setNoteModal] = useState<{
    kind: "return" | "reject-receipt";
    row: WorkPermit;
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  /** Modal firma digital: aprobar / recibir / cerrar / sin cierre. */
  const [signModal, setSignModal] = useState<{
    kind: WorkPermitSignKind;
    row: WorkPermit;
  } | null>(null);
  /** Modal completar personal + checklist (también staff, opción B). */
  const [completeRow, setCompleteRow] = useState<WorkPermit | null>(null);
  /** Modal Nuevo permiso P13/P13b. */
  const [createOpen, setCreateOpen] = useState(false);
  /** Confirmación soft-delete. */
  const [deleteRow, setDeleteRow] = useState<WorkPermit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setLoading(true);
    try {
      const result = await listWorkPermitsRequest(accessToken, 1, 100);
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar permisos",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, canRead, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Abre modal de firma digital (Prevención / capitán). */
  function openSignModal(kind: WorkPermitSignKind, row: WorkPermit) {
    setSignModal({ kind, row });
  }

  /** Abre modal con nota (devolver / no autorizar). */
  function openNoteModal(kind: "return" | "reject-receipt", row: WorkPermit) {
    setReviewNote("");
    setNoteModal({ kind, row });
  }

  /** Confirma firma digital y ejecuta la transición. */
  async function confirmSign(
    payload: WorkPermitDigitalSignaturePayload & { reviewNote?: string },
  ) {
    if (!accessToken || !signModal || actingId) return;
    const { kind, row } = signModal;
    setActingId(row.id);
    try {
      if (kind === "approve") {
        await approveWorkPermitRequest(accessToken, row.id, payload);
        showToast(
          `${row.code} · ${workPermitStatusLabel("to_receive")}.`,
          "success",
        );
      } else if (kind === "receive") {
        await receiveWorkPermitRequest(accessToken, row.id, payload);
        showToast(
          `${row.code} · ${workPermitStatusLabel("active")}.`,
          "success",
        );
      } else if (kind === "close") {
        await closeWorkPermitRequest(accessToken, row.id, payload);
        showToast(
          `${row.code} · ${workPermitStatusLabel("closed")}.`,
          "success",
        );
      } else {
        await rejectCloseWorkPermitRequest(
          accessToken,
          row.id,
          payload.reviewNote ?? "",
          payload,
        );
        showToast(
          `${row.code} · ${workPermitStatusLabel("no_closure")}.`,
          "success",
        );
      }
      setSignModal(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo firmar.",
        "danger",
      );
    } finally {
      setActingId(null);
    }
  }

  /** Pedir cierre (active → to_verify). */
  async function onRequestClose(row: WorkPermit) {
    if (!accessToken || !canUpdate || actingId) return;
    if (row.status !== "active") return;
    setActingId(row.id);
    try {
      await requestCloseWorkPermitRequest(accessToken, row.id);
      showToast(
        `${row.code} · ${workPermitStatusLabel("to_verify")}.`,
        "success",
      );
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo pedir el cierre.",
        "danger",
      );
    } finally {
      setActingId(null);
    }
  }

  /** Confirma modal con nota (devolver / no autorizar). */
  async function confirmNoteModal() {
    if (!accessToken || !noteModal || !reviewNote.trim() || actingId) return;
    setActingId(noteModal.row.id);
    try {
      if (noteModal.kind === "return") {
        await returnWorkPermitRequest(
          accessToken,
          noteModal.row.id,
          reviewNote.trim(),
        );
        showToast(
          `${noteModal.row.code} · ${workPermitStatusLabel("to_complete")}.`,
          "success",
        );
      } else {
        await rejectReceiptWorkPermitRequest(
          accessToken,
          noteModal.row.id,
          reviewNote.trim(),
        );
        showToast(
          `${noteModal.row.code} · vuelve a ${workPermitStatusLabel("to_approve")}.`,
          "success",
        );
      }
      setNoteModal(null);
      setReviewNote("");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setActingId(null);
    }
  }

  /** Soft-delete PT (+ aviso origen). */
  async function onConfirmDelete() {
    if (!accessToken || !deleteRow || deleting) return;
    setDeleting(true);
    try {
      await deleteWorkPermitRequest(accessToken, deleteRow.id);
      showToast(`${deleteRow.code} eliminado.`, "success");
      setDeleteRow(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo eliminar el permiso.",
        "danger",
      );
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        row.workNotice.code.toLowerCase().includes(q) ||
        row.organization.name.toLowerCase().includes(q) ||
        row.organization.rut.toLowerCase().includes(q),
    );
  }, [items, search]);

  const {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    total,
  } = useClientTablePagination(filtered);

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
            No tenés permiso work_permits.read, o el módulo work_permits está
            apagado.
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
            { label: "Permisos de trabajo" },
          ]}
          title="Permisos de trabajo"
          description="Prevención crea cada permiso desde un aviso, aprueba o devuelve; el capitán recibe y fiscaliza el cierre."
          actions={
            <div className="flex items-center gap-2">
              <Link
                to="/prevencion/avisos"
                className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
              >
                Ir a avisos
              </Link>
              {canCreate && isStaff ? (
                <Button
                  type="button"
                  size="medium"
                  className="!w-auto"
                  onClick={() => setCreateOpen(true)}
                >
                  Nuevo permiso
                </Button>
              ) : null}
            </div>
          }
        />

        <DataTableCard
          toolbar={
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar PT, aviso o empresa…"
            />
          }
          footer={
            <TablePagination
              totalLabel={
                loading
                  ? "Cargando…"
                  : `${total} ${total === 1 ? "permiso" : "permisos"}`
              }
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
                <th className="px-3 py-2.5">Permiso</th>
                <th className="px-3 py-2.5">Aviso</th>
                <th className="px-3 py-2.5">Empresa</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Nave</th>
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Avance</th>
                <th className="sticky right-0 z-10 bg-[var(--color-table-head-bg,#f8f9fb)] px-3 py-2.5 text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    No hay permisos. Creá uno desde un aviso en Avisos de
                    trabajo.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-t border-[var(--color-tremor-border)] hover:bg-[var(--color-nachipa-bg-page)]"
                  >
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                      <Link
                        to={`/prevencion/permisos/${row.id}`}
                        className="hover:text-[var(--color-nachipa-primary)] hover:underline"
                      >
                        {row.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                      {row.workNotice.code}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block font-medium text-[var(--color-nachipa-title)]">
                        {displayName(row.organization.name)}
                      </span>
                      <span className="text-[12px] tabular-nums text-[var(--color-nachipa-secondary)]">
                        {row.organization.rut}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {row.permitType.code}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {displayName(row.location.name)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                      {formatDate(row.scheduledDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip tone={statusTone(row.status)}>
                        {workPermitStatusLabel(row.status)}
                      </StatusChip>
                    </td>
                    <td className="px-3 py-2.5">
                      <WorkPermitProgressCell status={row.status} />
                    </td>
                    <td className="sticky right-0 z-10 whitespace-nowrap bg-white px-3 py-2.5 text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)] group-hover:bg-[var(--color-nachipa-bg-page)]">
                      {/* Aprobar solo dentro del PT (evita clic accidental en la lista). */}
                      <span className="inline-flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
                        {/* Siempre visible: Acciones nunca queda vacía. */}
                        <Link
                          to={`/prevencion/permisos/${row.id}`}
                          className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                        >
                          Ver
                        </Link>
                        {canUpdate && row.status === "to_complete" ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                            onClick={() => setCompleteRow(row)}
                          >
                            Completar
                          </button>
                        ) : null}
                        {canUpdate &&
                        isStaff &&
                        row.status === "to_approve" ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-title)] hover:underline disabled:opacity-60"
                            disabled={actingId === row.id}
                            onClick={() => openNoteModal("return", row)}
                          >
                            Devolver
                          </button>
                        ) : null}
                        {canReceive &&
                        isStaff &&
                        row.status === "to_receive" ? (
                          <>
                            <button
                              type="button"
                              className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-60"
                              disabled={actingId === row.id}
                              onClick={() => openSignModal("receive", row)}
                            >
                              {actingId === row.id ? "…" : "Autorizar a bordo"}
                            </button>
                            <button
                              type="button"
                              className="text-[13px] font-medium text-[var(--color-nachipa-title)] hover:underline disabled:opacity-60"
                              disabled={actingId === row.id}
                              onClick={() =>
                                openNoteModal("reject-receipt", row)
                              }
                            >
                              No autorizar
                            </button>
                          </>
                        ) : null}
                        {canUpdate && row.status === "active" ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-60"
                            disabled={actingId === row.id}
                            onClick={() => void onRequestClose(row)}
                          >
                            {actingId === row.id ? "…" : "Pedir cierre"}
                          </button>
                        ) : null}
                        {canReceive &&
                        isStaff &&
                        row.status === "to_verify" ? (
                          <>
                            <button
                              type="button"
                              className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-60"
                              disabled={actingId === row.id}
                              onClick={() => openSignModal("close", row)}
                            >
                              {actingId === row.id ? "…" : "Cerrar trabajo"}
                            </button>
                            <button
                              type="button"
                              className="text-[13px] font-medium text-[var(--color-nachipa-title)] hover:underline disabled:opacity-60"
                              disabled={actingId === row.id}
                              onClick={() =>
                                openSignModal("reject-close", row)
                              }
                            >
                              Sin cierre
                            </button>
                          </>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-secondary)] hover:text-[var(--color-status-danger-fg,#b91c1c)] hover:underline"
                            onClick={() => setDeleteRow(row)}
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableCard>
      </div>

      {accessToken ? (
        <WorkPermitCompleteModal
          open={Boolean(completeRow)}
          permit={completeRow}
          accessToken={accessToken}
          mode="staff"
          onClose={() => setCompleteRow(null)}
          onDone={() => void load()}
        />
      ) : null}

      {accessToken && canCreate && isStaff ? (
        <WorkPermitCreateModal
          open={createOpen}
          accessToken={accessToken}
          onClose={() => setCreateOpen(false)}
          onCreated={(permitId) => {
            void load();
            navigate(`/prevencion/permisos/${permitId}`);
          }}
        />
      ) : null}

      <WorkPermitSignModal
        open={Boolean(signModal)}
        kind={signModal?.kind ?? null}
        permitCode={signModal?.row.code}
        defaultSignerName={
          user
            ? `${user.firstName} ${user.lastName}`.trim() || user.email
            : ""
        }
        submitting={Boolean(actingId && signModal)}
        onClose={() => {
          if (!actingId) setSignModal(null);
        }}
        onConfirm={(payload) => void confirmSign(payload)}
      />

      <Modal
        open={Boolean(noteModal)}
        onClose={() => {
          if (!actingId) setNoteModal(null);
        }}
        title={
          noteModal?.kind === "reject-receipt"
            ? "No autorizar recepción"
            : "Devolver permiso al contratista"
        }
        subtitle={
          noteModal
            ? `${noteModal.row.code} · ${displayName(noteModal.row.organization.name)}`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={Boolean(actingId)}
              onClick={() => setNoteModal(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={Boolean(actingId) || !reviewNote.trim()}
              onClick={() => void confirmNoteModal()}
            >
              {actingId
                ? "Guardando…"
                : noteModal?.kind === "reject-receipt"
                  ? "No autorizar"
                  : "Devolver"}
            </Button>
          </div>
        }
      >
        <p className="m-0 mb-3 text-[13px] text-[var(--color-nachipa-secondary)]">
          {noteModal?.kind === "reject-receipt"
            ? "El permiso vuelve a «En revisión» (Prevención) con tu motivo."
            : "El permiso vuelve a «Por completar» con tu observación."}
        </p>
        <TextField
          label={
            noteModal?.kind === "reject-receipt" ? "Motivo" : "Observaciones"
          }
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          required
        />
      </Modal>

      <Modal
        open={Boolean(deleteRow)}
        onClose={() => {
          if (!deleting) setDeleteRow(null);
        }}
        title="Eliminar permiso"
        subtitle={
          deleteRow
            ? `${deleteRow.code} · ${displayName(deleteRow.organization.name)}`
            : undefined
        }
        maxWidthClass="max-w-[440px]"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteRow(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={deleting}
              onClick={() => void onConfirmDelete()}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[13px] text-[var(--color-nachipa-body)]">
          Se quita de la bandeja junto con el aviso{" "}
          {deleteRow ? deleteRow.workNotice.code : ""}. Esta acción no se puede
          deshacer desde la UI.
        </p>
      </Modal>
    </div>
  );
}
