import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { ClipboardCheck, MoreVertical, Plus } from "lucide-react";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
import { TextField } from "../../components/TextField/TextField";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  approveAccreditationRequest,
  createAccreditationRequest,
  listAccreditationsRequest,
  rejectAccreditationRequest,
  returnAccreditationRequest,
  submitAccreditationRequest,
  type AccreditationStatus,
  type ContractorAccreditation,
} from "../../lib/api/accreditations";
import {
  listContractorsRequest,
  type ContractorOrganization,
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

/** Etiqueta de estado. */
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

/** Tono del chip por estado. */
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

/** Formato corto de fecha ISO. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL");
  } catch {
    return "—";
  }
}

const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

const outlineBtnClass =
  "inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/** Acción pendiente con nota (devolver / rechazar). */
type NoteAction = {
  kind: "return" | "reject";
  row: ContractorAccreditation;
};

/**
 * Bandeja de habilitaciones (P2).
 * Solicitar docs + transiciones submit / approve / return / reject.
 * Sin carga de documentos aún (llega con revisión P5).
 */
export function AccreditationsPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const canRead = userHasPermission(user, "accreditations", "read");
  const canCreate = userHasPermission(user, "accreditations", "create");
  const canUpdate = userHasPermission(user, "accreditations", "update");

  const [items, setItems] = useState<ContractorAccreditation[]>([]);
  const [orgs, setOrgs] = useState<ContractorOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [noteAction, setNoteAction] = useState<NoteAction | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setLoading(true);
    try {
      const result = await listAccreditationsRequest(accessToken, 1, 100);
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar habilitaciones",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, canRead, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!accessToken || !canCreate) return;
    void listContractorsRequest(accessToken, 1, 100, { active: true })
      .then((r) => setOrgs(r.items))
      .catch(() => setOrgs([]));
  }, [accessToken, canCreate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
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

  /** Abre modal solicitar. */
  function openCreate() {
    setOrganizationId("");
    setMessage(
      "Favor subir la documentación del pack empresa para habilitación.",
    );
    setCreateOpen(true);
  }

  /** POST solicitar documentación. */
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || submitting || !organizationId) return;
    setSubmitting(true);
    try {
      await createAccreditationRequest(accessToken, {
        organizationId,
        message: message.trim() || null,
        dueAt: null,
      });
      showToast("Solicitud creada.", "success");
      setCreateOpen(false);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo crear.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** Ejecuta submit / approve sin nota. */
  async function runSimple(
    kind: "submit" | "approve",
    row: ContractorAccreditation,
  ) {
    if (!accessToken || acting) return;
    setMenuId(null);
    setActing(true);
    try {
      if (kind === "submit") {
        await submitAccreditationRequest(accessToken, row.id);
        showToast("Enviada a revisión.", "success");
      } else {
        await approveAccreditationRequest(accessToken, row.id);
        showToast("Habilitación aprobada.", "success");
      }
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo completar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  /** Confirma devolver / rechazar con nota. */
  async function confirmNoteAction() {
    if (!accessToken || !noteAction || !reviewNote.trim() || acting) return;
    setActing(true);
    try {
      if (noteAction.kind === "return") {
        await returnAccreditationRequest(
          accessToken,
          noteAction.row.id,
          reviewNote.trim(),
        );
        showToast("Devuelta con observaciones.", "success");
      } else {
        await rejectAccreditationRequest(
          accessToken,
          noteAction.row.id,
          reviewNote.trim(),
        );
        showToast("Habilitación rechazada.", "success");
      }
      setNoteAction(null);
      setReviewNote("");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo completar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

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
            No tenés permiso accreditations.read, o el módulo contractors está
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
            { label: "Habilitaciones" },
          ]}
          title="Habilitaciones"
          description="Solicitar y revisar documentación de organizaciones contratistas (HAB). La carga de archivos llega en el siguiente paso."
          actions={
            canCreate ? (
              <Button
                type="button"
                size="medium"
                className="!w-auto"
                onClick={openCreate}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                Solicitar documentación
              </Button>
            ) : null
          }
        />

        <DataTableCard
          toolbar={
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar HAB, RUT o nombre…"
            />
          }
          footer={
            <TablePagination
              totalLabel={
                loading
                  ? "Cargando…"
                  : `${total} ${total === 1 ? "habilitación" : "habilitaciones"}`
              }
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
                <th className="px-3 py-2.5">Código</th>
                <th className="px-3 py-2.5">Organización</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Solicitada</th>
                <th className="px-3 py-2.5">Plazo</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    No hay habilitaciones. Solicitá documentación a una
                    organización.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-tremor-border)] hover:bg-[var(--color-nachipa-bg-page)]"
                  >
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                      {row.code}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block font-medium text-[var(--color-nachipa-title)]">
                        {displayName(row.organization.name)}
                      </span>
                      <span className="text-[12px] tabular-nums text-[var(--color-nachipa-secondary)]">
                        {row.organization.rut}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip tone={statusTone(row.status)}>
                        {statusLabel(row.status)}
                      </StatusChip>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {formatDate(row.requestedAt)}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {formatDate(row.dueAt)}
                    </td>
                    <td className="relative px-3 py-2.5 text-right">
                      {canUpdate ? (
                        <>
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nachipa-secondary)] hover:bg-white hover:text-[var(--color-nachipa-title)]"
                            aria-label="Acciones"
                            disabled={acting}
                            onClick={() =>
                              setMenuId((id) =>
                                id === row.id ? null : row.id,
                              )
                            }
                          >
                            <MoreVertical
                              className="size-4"
                              strokeWidth={1.5}
                              aria-hidden
                            />
                          </button>
                          {menuId === row.id ? (
                            <div className="absolute right-3 z-10 mt-1 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white py-1 shadow-sm">
                              {(row.status === "pending" ||
                                row.status === "observed") && (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                                  onClick={() => void runSimple("submit", row)}
                                >
                                  Enviar a revisión
                                </button>
                              )}
                              {row.status === "in_review" ? (
                                <>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                                    onClick={() =>
                                      void runSimple("approve", row)
                                    }
                                  >
                                    Aprobar
                                  </button>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                                    onClick={() => {
                                      setMenuId(null);
                                      setReviewNote("");
                                      setNoteAction({ kind: "return", row });
                                    }}
                                  >
                                    Devolver
                                  </button>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-status-danger-fg)] hover:bg-[var(--color-nachipa-bg-page)]"
                                    onClick={() => {
                                      setMenuId(null);
                                      setReviewNote("");
                                      setNoteAction({ kind: "reject", row });
                                    }}
                                  >
                                    Rechazar
                                  </button>
                                </>
                              ) : null}
                              {row.status === "approved" ||
                              row.status === "rejected" ? (
                                <span className="block px-3 py-1.5 text-[12px] text-[var(--color-nachipa-secondary)]">
                                  Sin acciones
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableCard>
      </div>

      <Modal
        open={createOpen}
        onClose={() => {
          if (!submitting) setCreateOpen(false);
        }}
        icon={ClipboardCheck}
        title="Solicitar documentación"
        subtitle="Crea una habilitación HAB en estado pendiente para la organización."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setCreateOpen(false)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="accreditation-create-form"
              size="medium"
              className="!w-auto"
              disabled={submitting || !organizationId}
            >
              {submitting ? "Creando…" : "Solicitar"}
            </Button>
          </div>
        }
      >
        <form
          id="accreditation-create-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => void onCreate(e)}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Organización
            </span>
            <select
              className={selectClass}
              required
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rut} · {displayName(o.name)}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Mensaje al contratista"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(noteAction)}
        onClose={() => {
          if (!acting) setNoteAction(null);
        }}
        title={
          noteAction?.kind === "return"
            ? "Devolver con observaciones"
            : "Rechazar habilitación"
        }
        subtitle={
          noteAction
            ? `${noteAction.row.code} · ${displayName(noteAction.row.organization.name)}`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => setNoteAction(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={acting || !reviewNote.trim()}
              onClick={() => void confirmNoteAction()}
            >
              {acting
                ? "Guardando…"
                : noteAction?.kind === "return"
                  ? "Devolver"
                  : "Rechazar"}
            </Button>
          </div>
        }
      >
        <TextField
          label={
            noteAction?.kind === "return" ? "Observaciones" : "Motivo"
          }
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          required
        />
      </Modal>
    </div>
  );
}
