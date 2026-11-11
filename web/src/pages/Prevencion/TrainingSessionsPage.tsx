import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  CheckCircle2,
  GraduationCap,
  MoreVertical,
  Plus,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "../../components/Button/Button";
import { ConfirmModal } from "../../components/ConfirmModal/ConfirmModal";
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
import { userHasPermission } from "../../lib/api/auth";
import { fileToBase64 } from "../../lib/api/crewMemberDocuments";
import {
  listCrewMembersRequest,
  type CrewMember,
} from "../../lib/api/crewMembers";
import {
  cancelTrainingSessionRequest,
  completeTrainingSessionRequest,
  createTrainingSessionRequest,
  listTrainingSessionsRequest,
  uploadTrainingSessionCertificateRequest,
  type TrainingSession,
  type TrainingSessionStatus,
} from "../../lib/api/trainingSessions";
import {
  listTrainingsRequest,
  type Training,
} from "../../lib/api/trainings";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Pasos del wizard de nueva sesión. */
type WizardStep = 1 | 2 | 3;

/** Clase de selects del modal. */
const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

/** YYYY-MM-DD local para input date. */
function todayInputValue(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Fecha del input → ISO al mediodía local. */
function dateInputToIso(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  const local = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  return local.toISOString();
}

/** Fecha corta es-CL. */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Chip de estado de sesión. */
function statusTone(
  status: TrainingSessionStatus,
): "success" | "warning" | "neutral" | "danger" {
  if (status === "completed") return "success";
  if (status === "draft") return "warning";
  return "neutral";
}

/** Etiqueta de estado. */
function statusLabel(status: TrainingSessionStatus): string {
  if (status === "completed") return "Cerrada";
  if (status === "draft") return "Borrador";
  return "Cancelada";
}

/** MIME para upload del acta. */
function resolveUploadMime(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

/**
 * Sesiones de capacitación Prevención (grupal o individual).
 * Crear borrador → seleccionar gente → subir acta → cerrar.
 */
export function TrainingSessionsPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();

  const canCreate = userHasPermission(user, "trainings", "create");
  const canUpdate = userHasPermission(user, "trainings", "update");
  const canCancel = userHasPermission(user, "trainings", "deactivate");

  const [items, setItems] = useState<TrainingSession[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    TrainingSessionStatus | "all"
  >("all");
  const [menuId, setMenuId] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [trainingId, setTrainingId] = useState("");
  const [heldAt, setHeldAt] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [crewSearch, setCrewSearch] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [pendingComplete, setPendingComplete] =
    useState<TrainingSession | null>(null);
  const [completing, setCompleting] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<TrainingSession | null>(
    null,
  );
  const [cancelling, setCancelling] = useState(false);
  const [uploadFor, setUploadFor] = useState<TrainingSession | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  /** Carga sesiones + catálogos para el wizard. */
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [sessions, cats, members] = await Promise.all([
        listTrainingSessionsRequest(accessToken, 1, 100),
        listTrainingsRequest(accessToken, 1, 100, { active: true }),
        listCrewMembersRequest(accessToken, {
          page: 1,
          limit: 200,
          includeInactive: false,
        }),
      ]);
      setItems(sessions.items);
      setTrainings(
        cats.items.filter(
          (t) => t.active && t.appliesTo.includes("crew"),
        ),
      );
      setCrew(members.items.filter((c) => c.state && !c.deletedAt));
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las sesiones",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${row.training?.code ?? ""} ${row.training?.name ?? ""} ${row.notes ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, statusFilter]);

  const { page, setPage, pageSize, setPageSize, pageCount, pageItems, total } =
    useClientTablePagination(filtered);

  /** Resetea el wizard. */
  function resetWizard() {
    setWizardStep(1);
    setTrainingId("");
    setHeldAt(todayInputValue());
    setNotes("");
    setSelectedCrewIds([]);
    setCrewSearch("");
    setCertificateFile(null);
  }

  /** Abre wizard nueva sesión. */
  function openWizard() {
    resetWizard();
    setWizardOpen(true);
  }

  /** Cierra wizard si no está enviando. */
  function closeWizard() {
    if (submitting) return;
    setWizardOpen(false);
    resetWizard();
  }

  /** Alterna selección de un embarcado. */
  function toggleCrew(id: string) {
    setSelectedCrewIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const crewFiltered = useMemo(() => {
    const q = crewSearch.trim().toLowerCase();
    if (!q) return crew;
    return crew.filter((c) => {
      const hay =
        `${c.firstName} ${c.lastName} ${c.run} ${c.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [crew, crewSearch]);

  const selectedTraining = trainings.find((t) => t.id === trainingId) ?? null;

  /** Crea sesión, sube acta y cierra en un flujo. */
  async function onSubmitWizard(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canCreate) return;
    if (!trainingId) {
      showToast("Elegí una capacitación.", "danger");
      return;
    }
    if (selectedCrewIds.length === 0) {
      showToast("Seleccioná al menos una persona.", "danger");
      return;
    }
    if (!certificateFile) {
      showToast("Subí el acta/PDF de la sesión.", "danger");
      setWizardStep(3);
      return;
    }
    if (selectedTraining && !selectedTraining.documentTypeId) {
      showToast(
        "Esta capacitación no tiene tipo de documento de evidencia. Configuralo en el catálogo.",
        "danger",
      );
      return;
    }

    setSubmitting(true);
    try {
      const created = await createTrainingSessionRequest(accessToken, {
        trainingId,
        heldAt: dateInputToIso(heldAt),
        notes: notes.trim() || null,
        crewMemberIds: selectedCrewIds,
      });
      const contentBase64 = await fileToBase64(certificateFile);
      await uploadTrainingSessionCertificateRequest(accessToken, created.id, {
        fileName: certificateFile.name,
        mimeType: resolveUploadMime(certificateFile),
        contentBase64,
      });
      await completeTrainingSessionRequest(accessToken, created.id);
      showToast(
        selectedCrewIds.length === 1
          ? "Capacitación individual registrada."
          : `Sesión grupal cerrada · ${selectedCrewIds.length} personas.`,
        "success",
      );
      closeWizard();
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cerrar la sesión",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** Sube acta a un borrador existente. */
  async function onUploadCertificate(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !uploadFor || !uploadFile || !canUpdate) return;
    setUploading(true);
    try {
      const contentBase64 = await fileToBase64(uploadFile);
      await uploadTrainingSessionCertificateRequest(accessToken, uploadFor.id, {
        fileName: uploadFile.name,
        mimeType: resolveUploadMime(uploadFile),
        contentBase64,
      });
      showToast("Acta cargada.", "success");
      setUploadFor(null);
      setUploadFile(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo subir el acta",
        "danger",
      );
    } finally {
      setUploading(false);
    }
  }

  /** Cierra un borrador que ya tiene acta. */
  async function onConfirmComplete() {
    if (!accessToken || !pendingComplete || !canUpdate) return;
    setCompleting(true);
    try {
      await completeTrainingSessionRequest(accessToken, pendingComplete.id);
      showToast("Sesión cerrada. Fichas actualizadas.", "success");
      setPendingComplete(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cerrar la sesión",
        "danger",
      );
    } finally {
      setCompleting(false);
    }
  }

  /** Cancela borrador. */
  async function onConfirmCancel() {
    if (!accessToken || !pendingCancel || !canCancel) return;
    setCancelling(true);
    try {
      await cancelTrainingSessionRequest(accessToken, pendingCancel.id);
      showToast("Sesión cancelada.", "success");
      setPendingCancel(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cancelar",
        "danger",
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Prevención"
        breadcrumbIcon={GraduationCap}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Capacitaciones", to: "/prevencion/capacitaciones" },
            { label: "Sesiones" },
          ]}
          title="Sesiones de capacitación"
          description="Registrá capacitaciones grupales o individuales: elegí personas, subí el acta y cerrá la sesión."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/prevencion/capacitaciones"
                className="inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95"
              >
                Ver catálogo
              </Link>
              {canCreate ? (
                <Button
                  type="button"
                  size="medium"
                  className="!w-auto"
                  onClick={openWizard}
                >
                  <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                  Nueva sesión
                </Button>
              ) : null}
            </div>
          }
        />

        <DataTableCard
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <DataTableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar por código o nombre…"
              />
              <select
                className="h-9 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[13px] text-[var(--color-nachipa-body)]"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as TrainingSessionStatus | "all",
                  )
                }
              >
                <option value="all">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="completed">Cerrada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          }
          footer={
            <TablePagination
              totalLabel={
                loading
                  ? "Cargando…"
                  : `${total} ${total === 1 ? "sesión" : "sesiones"}`
              }
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--color-nachipa-bg-page)] text-[12px] text-[var(--color-nachipa-secondary)]">
                <th className="rounded-tl-[var(--radius-md)] px-3 py-2.5 font-medium">
                  Capacitación
                </th>
                <th className="px-3 py-2.5 font-medium">Fecha</th>
                <th className="px-3 py-2.5 font-medium">Asistentes</th>
                <th className="px-3 py-2.5 font-medium">Acta</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="rounded-tr-[var(--radius-md)] px-3 py-2.5 text-right font-medium">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-[var(--color-nachipa-secondary)]"
                  >
                    No hay sesiones.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-nachipa-border-subtle)]"
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-[var(--color-nachipa-title)]">
                        {row.training?.code ?? "—"}
                      </p>
                      <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                        {row.training?.name ?? "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                      {formatDay(row.heldAt)}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      <span className="inline-flex items-center gap-1">
                        <Users size={14} strokeWidth={1.5} aria-hidden />
                        {row.attendeeCount}
                        {row.attendeeCount === 1 ? " (individual)" : ""}
                      </span>
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {row.hasCertificate
                        ? (row.fileOriginalName ?? "Cargada")
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip tone={statusTone(row.status)}>
                        {statusLabel(row.status)}
                      </StatusChip>
                    </td>
                    <td className="relative px-3 py-2.5 text-right">
                      {row.status === "draft" ? (
                        <>
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-md text-[var(--color-nachipa-secondary)] hover:bg-[var(--color-nachipa-tab)]"
                            onClick={() =>
                              setMenuId((id) => (id === row.id ? null : row.id))
                            }
                            aria-label="Acciones"
                          >
                            <MoreVertical size={16} strokeWidth={1.5} />
                          </button>
                          {menuId === row.id ? (
                            <div className="absolute right-3 z-10 mt-1 w-44 rounded-[10px] border border-[var(--color-tremor-border)] bg-white py-1 shadow-md">
                              {canUpdate ? (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--color-nachipa-tab)]"
                                  onClick={() => {
                                    setMenuId(null);
                                    setUploadFor(row);
                                    setUploadFile(null);
                                  }}
                                >
                                  {row.hasCertificate
                                    ? "Reemplazar acta"
                                    : "Subir acta"}
                                </button>
                              ) : null}
                              {canUpdate && row.hasCertificate ? (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--color-nachipa-tab)]"
                                  onClick={() => {
                                    setMenuId(null);
                                    setPendingComplete(row);
                                  }}
                                >
                                  Cerrar sesión
                                </button>
                              ) : null}
                              {canCancel ? (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-status-danger-fg,#b42318)] hover:bg-[var(--color-nachipa-tab)]"
                                  onClick={() => {
                                    setMenuId(null);
                                    setPendingCancel(row);
                                  }}
                                >
                                  Cancelar
                                </button>
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
        open={wizardOpen}
        icon={GraduationCap}
        title="Nueva sesión de capacitación"
        subtitle={
          wizardStep === 1
            ? "Paso 1 · Capacitación y fecha"
            : wizardStep === 2
              ? "Paso 2 · Participantes (1 = individual)"
              : "Paso 3 · Acta PDF y cierre"
        }
        onClose={closeWizard}
        maxWidthClass="w-full max-w-[560px] sm:w-[560px]"
        footer={
          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] disabled:opacity-60"
              onClick={() => {
                if (wizardStep === 1) closeWizard();
                else setWizardStep((s) => (s === 3 ? 2 : 1));
              }}
              disabled={submitting}
            >
              {wizardStep === 1 ? "Cancelar" : "Atrás"}
            </button>
            {wizardStep < 3 ? (
              <Button
                type="button"
                className="!w-auto"
                disabled={submitting}
                onClick={() => {
                  if (wizardStep === 1 && !trainingId) {
                    showToast("Elegí una capacitación.", "danger");
                    return;
                  }
                  if (wizardStep === 2 && selectedCrewIds.length === 0) {
                    showToast("Seleccioná al menos una persona.", "danger");
                    return;
                  }
                  setWizardStep((s) => (s === 1 ? 2 : 3));
                }}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                type="submit"
                form="training-session-wizard"
                className="!w-auto"
                disabled={submitting || !canCreate}
              >
                {submitting ? "Registrando…" : "Cerrar y registrar"}
              </Button>
            )}
          </div>
        }
      >
        <form
          id="training-session-wizard"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            void onSubmitWizard(e);
          }}
        >
          {wizardStep === 1 ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Capacitación *
                </span>
                <select
                  className={selectClass}
                  value={trainingId}
                  onChange={(e) => setTrainingId(e.target.value)}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {trainings.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} — {t.name}
                      {!t.documentTypeId ? " (sin tipo de evidencia)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Fecha *"
                type="date"
                value={heldAt}
                onChange={(e) => setHeldAt(e.target.value)}
                required
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Notas
                </span>
                <textarea
                  className="min-h-[80px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-nachipa-primary)]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                  placeholder="Opcional"
                />
              </label>
            </>
          ) : null}

          {wizardStep === 2 ? (
            <>
              <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                Seleccioná una persona (individual) o varias (grupal).{" "}
                <strong className="font-semibold text-[var(--color-nachipa-title)]">
                  {selectedCrewIds.length} seleccionadas
                </strong>
              </p>
              <TextField
                label="Buscar embarcado"
                value={crewSearch}
                onChange={(e) => setCrewSearch(e.target.value)}
                placeholder="Nombre, RUN o correo…"
              />
              <div className="max-h-[280px] overflow-y-auto rounded-[10px] border border-[var(--color-tremor-border)]">
                {crewFiltered.length === 0 ? (
                  <p className="m-0 px-3 py-4 text-center text-[12px] text-[var(--color-nachipa-secondary)]">
                    Sin resultados.
                  </p>
                ) : (
                  <ul className="m-0 list-none p-0">
                    {crewFiltered.map((c) => {
                      const checked = selectedCrewIds.includes(c.id);
                      return (
                        <li
                          key={c.id}
                          className="border-b border-[var(--color-nachipa-border-subtle)] last:border-b-0"
                        >
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-[var(--color-nachipa-tab)]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCrew(c.id)}
                              className="size-4 accent-[var(--color-nachipa-primary)]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-[var(--color-nachipa-title)]">
                                {c.firstName} {c.lastName}
                              </span>
                              <span className="block truncate text-[11px] text-[var(--color-nachipa-secondary)]">
                                {c.run}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : null}

          {wizardStep === 3 ? (
            <>
              <div className="rounded-[10px] border border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg,#f8f9fb)] px-3 py-2.5 text-[12px] text-[var(--color-nachipa-body)]">
                <p className="m-0 font-medium text-[var(--color-nachipa-title)]">
                  {selectedTraining
                    ? `${selectedTraining.code} — ${selectedTraining.name}`
                    : "—"}
                </p>
                <p className="m-0 mt-1">
                  {formatDay(dateInputToIso(heldAt))} · {selectedCrewIds.length}{" "}
                  {selectedCrewIds.length === 1 ? "persona" : "personas"}
                </p>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Acta / PDF *
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf,image/*"
                  onChange={(e) =>
                    setCertificateFile(e.target.files?.[0] ?? null)
                  }
                  className="text-[13px] text-[var(--color-nachipa-body)]"
                  required
                />
                {certificateFile ? (
                  <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                    {certificateFile.name}
                  </span>
                ) : null}
              </label>
              <p className="m-0 flex items-start gap-2 text-[12px] text-[var(--color-nachipa-secondary)]">
                <CheckCircle2
                  className="mt-0.5 size-3.5 shrink-0 text-[var(--color-nachipa-primary)]"
                  strokeWidth={1.5}
                  aria-hidden
                />
                Al cerrar se registra la capacitación en cada ficha, se copia el
                acta a Documentos y queda en la bitácora.
              </p>
            </>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(uploadFor)}
        icon={GraduationCap}
        title="Subir acta"
        subtitle={
          uploadFor
            ? `${uploadFor.training?.code ?? ""} · ${formatDay(uploadFor.heldAt)}`
            : undefined
        }
        onClose={() => {
          if (uploading) return;
          setUploadFor(null);
          setUploadFile(null);
        }}
        maxWidthClass="w-full max-w-[440px]"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium disabled:opacity-60"
              onClick={() => {
                setUploadFor(null);
                setUploadFile(null);
              }}
              disabled={uploading}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="upload-session-certificate"
              className="!w-auto"
              disabled={uploading || !uploadFile}
            >
              {uploading ? "Subiendo…" : "Subir"}
            </Button>
          </div>
        }
      >
        <form
          id="upload-session-certificate"
          onSubmit={(e) => {
            void onUploadCertificate(e);
          }}
        >
          <input
            type="file"
            accept=".pdf,application/pdf,image/*"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            className="text-[13px]"
            required
          />
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(pendingComplete)}
        title="Cerrar sesión"
        message={
          pendingComplete
            ? `Se registrará la capacitación para ${pendingComplete.attendeeCount} persona(s) y se copiará el acta a cada ficha.`
            : ""
        }
        confirmLabel="Cerrar sesión"
        busyLabel="Cerrando…"
        onConfirm={() => {
          void onConfirmComplete();
        }}
        onClose={() => {
          if (!completing) setPendingComplete(null);
        }}
        busy={completing}
      />

      <ConfirmModal
        open={Boolean(pendingCancel)}
        title="Cancelar borrador"
        message="Se descartará esta sesión en borrador. Esta acción no se puede deshacer."
        confirmLabel="Cancelar sesión"
        busyLabel="Cancelando…"
        onConfirm={() => {
          void onConfirmCancel();
        }}
        onClose={() => {
          if (!cancelling) setPendingCancel(null);
        }}
        busy={cancelling}
      />
    </div>
  );
}
