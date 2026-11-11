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
  Upload,
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
  listLocationsRequest,
  type Location,
} from "../../lib/api/locations";
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

  const canCreate = userHasPermission(user, "training_sessions", "create");
  const canUpdate = userHasPermission(user, "training_sessions", "update");
  const canCancel = userHasPermission(user, "training_sessions", "deactivate");
  /** Link a ficha solo si el rol puede entrar a Embarcados. */
  const canOpenCrewFicha = userHasPermission(user, "embarcados", "read");

  const [items, setItems] = useState<TrainingSession[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  /** Naves activas del tenant (select del wizard). */
  const [vessels, setVessels] = useState<Location[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  /** Carga de embarcados al cambiar de nave. */
  const [loadingCrew, setLoadingCrew] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    TrainingSessionStatus | "all"
  >("all");
  const [menuId, setMenuId] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  /** Nave elegida: filtra participantes del paso 2. */
  const [locationId, setLocationId] = useState("");
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
  /** Detalle de asistentes (borrador, cerrada o cancelada). */
  const [viewAttendees, setViewAttendees] = useState<TrainingSession | null>(
    null,
  );

  /**
   * Carga sesiones (obligatorio) y, aparte, catálogo + naves para el wizard.
   * Un 403 de trainings/locations no debe vaciar la tabla ni spamear toasts.
   */
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const sessions = await listTrainingSessionsRequest(accessToken, 1, 100);
      setItems(sessions.items);
    } catch (err) {
      setItems([]);
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las sesiones",
        "danger",
      );
    } finally {
      setLoading(false);
    }

    // Catálogo de capacitaciones: solo hace falta para “Nueva sesión”.
    try {
      const cats = await listTrainingsRequest(accessToken, 1, 100, {
        active: true,
      });
      setTrainings(
        cats.items.filter((t) => t.active && t.appliesTo.includes("crew")),
      );
    } catch {
      setTrainings([]);
    }

    // Naves para el select del wizard.
    try {
      const locs = await listLocationsRequest(accessToken, 1, 100);
      setVessels(
        locs.items.filter(
          (loc) =>
            loc.state &&
            !loc.deletedAt &&
            (loc.kind === "vessel" || loc.kind == null),
        ),
      );
    } catch {
      setVessels([]);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Embarcados activos de una nave (tope API 100).
   * Se llama al elegir nave en el wizard.
   */
  const loadCrewForVessel = useCallback(
    async (vesselId: string) => {
      if (!accessToken || !vesselId) {
        setCrew([]);
        return;
      }
      setLoadingCrew(true);
      try {
        const members = await listCrewMembersRequest(accessToken, {
          page: 1,
          limit: 100,
          locationId: vesselId,
          includeInactive: false,
        });
        setCrew(members.items.filter((c) => c.state && !c.deletedAt));
      } catch (err) {
        setCrew([]);
        showToast(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los embarcados de la nave",
          "danger",
        );
      } finally {
        setLoadingCrew(false);
      }
    },
    [accessToken, showToast],
  );

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

  /** Resetea el wizard (nave: la del usuario si es nave conocida). */
  function resetWizard() {
    setWizardStep(1);
    const preferred =
      user?.locationId && vessels.some((v) => v.id === user.locationId)
        ? user.locationId
        : "";
    setLocationId(preferred);
    setTrainingId("");
    setHeldAt(todayInputValue());
    setNotes("");
    setSelectedCrewIds([]);
    setCrewSearch("");
    setCertificateFile(null);
    setCrew([]);
    if (preferred) {
      void loadCrewForVessel(preferred);
    }
  }

  /** Abre wizard nueva sesión. */
  function openWizard() {
    resetWizard();
    setWizardOpen(true);
  }

  /** Cambia nave: limpia selección y recarga embarcados. */
  function onVesselChange(nextId: string) {
    setLocationId(nextId);
    setSelectedCrewIds([]);
    setCrewSearch("");
    void loadCrewForVessel(nextId);
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
  const selectedVessel = vessels.find((v) => v.id === locationId) ?? null;

  /**
   * Guarda borrador (sin cerrar). PDF opcional ahora;
   * el cierre se hace después desde el listado con “Cerrar sesión”.
   */
  async function onSubmitWizard(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canCreate) return;
    if (!locationId) {
      showToast("Elegí una nave.", "danger");
      setWizardStep(1);
      return;
    }
    if (!trainingId) {
      showToast("Elegí una capacitación.", "danger");
      setWizardStep(1);
      return;
    }
    if (selectedCrewIds.length === 0) {
      showToast("Seleccioná al menos una persona.", "danger");
      setWizardStep(2);
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
        locationId,
        heldAt: dateInputToIso(heldAt),
        notes: notes.trim() || null,
        crewMemberIds: selectedCrewIds,
      });
      if (certificateFile) {
        const contentBase64 = await fileToBase64(certificateFile);
        await uploadTrainingSessionCertificateRequest(accessToken, created.id, {
          fileName: certificateFile.name,
          mimeType: resolveUploadMime(certificateFile),
          contentBase64,
        });
      }
      showToast(
        certificateFile
          ? "Borrador guardado con acta. Cerralo cuando esté listo."
          : "Borrador guardado. Subí el acta y cerrá la sesión cuando corresponda.",
        "success",
      );
      closeWizard();
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar la sesión",
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
          description="Creá un borrador (nave + personas), subí el acta cuando esté y cerrá la sesión después."
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
                <th className="px-3 py-2.5 font-medium">Nave</th>
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
                    colSpan={7}
                    className="px-3 py-8 text-center text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
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
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {row.location?.name ?? "—"}
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
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--color-nachipa-tab)]"
                            onClick={() => {
                              setMenuId(null);
                              setViewAttendees(row);
                            }}
                          >
                            Ver asistentes
                          </button>
                          {row.status === "draft" && canUpdate ? (
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
                          {row.status === "draft" &&
                          canUpdate &&
                          row.hasCertificate ? (
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
                          {row.status === "draft" && canCancel ? (
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
            ? "Paso 1 · Nave, capacitación y fecha"
            : wizardStep === 2
              ? "Paso 2 · Embarcados de la nave (1 = individual)"
              : "Paso 3 · Acta PDF (opcional) y guardar borrador"
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
                  if (wizardStep === 1 && !locationId) {
                    showToast("Elegí una nave.", "danger");
                    return;
                  }
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
                {submitting ? "Guardando…" : "Guardar borrador"}
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
                  Nave *
                </span>
                <select
                  className={selectClass}
                  value={locationId}
                  onChange={(e) => onVesselChange(e.target.value)}
                  required
                >
                  <option value="">Seleccionar nave…</option>
                  {vessels.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
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
                {selectedVessel ? (
                  <>
                    Embarcados de{" "}
                    <strong className="font-semibold text-[var(--color-nachipa-title)]">
                      {selectedVessel.name}
                    </strong>
                    . Una persona = individual; varias = grupal.{" "}
                  </>
                ) : (
                  "Elegí una nave en el paso anterior. "
                )}
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
                {loadingCrew ? (
                  <p className="m-0 px-3 py-4 text-center text-[12px] text-[var(--color-nachipa-secondary)]">
                    Cargando embarcados…
                  </p>
                ) : crewFiltered.length === 0 ? (
                  <p className="m-0 px-3 py-4 text-center text-[12px] text-[var(--color-nachipa-secondary)]">
                    {locationId
                      ? "No hay embarcados activos en esta nave."
                      : "Sin resultados."}
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
                  {selectedVessel ? `${selectedVessel.name} · ` : ""}
                  {formatDay(dateInputToIso(heldAt))} · {selectedCrewIds.length}{" "}
                  {selectedCrewIds.length === 1 ? "persona" : "personas"}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Acta / PDF
                </span>
                {/* Botón visible: el input nativo solo dice “Seleccionar archivo”. */}
                <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]">
                  <Upload
                    className="size-4 shrink-0 text-[var(--color-icon-default)]"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  {certificateFile ? "Cambiar archivo" : "Elegir archivo"}
                  <input
                    type="file"
                    accept=".pdf,application/pdf,image/*"
                    onChange={(e) =>
                      setCertificateFile(e.target.files?.[0] ?? null)
                    }
                    className="sr-only"
                  />
                </label>
                {certificateFile ? (
                  <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                    {certificateFile.name}
                  </span>
                ) : (
                  <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                    Opcional ahora. Podés subirla después desde el listado.
                  </span>
                )}
              </div>
              <p className="m-0 flex items-start gap-2 text-[12px] text-[var(--color-nachipa-secondary)]">
                <CheckCircle2
                  className="mt-0.5 size-3.5 shrink-0 text-[var(--color-nachipa-primary)]"
                  strokeWidth={1.5}
                  aria-hidden
                />
                Se guarda como borrador. Al cerrar la sesión (con acta) se
                registra en cada ficha, se copia a Documentos y queda en la
                bitácora.
              </p>
            </>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(viewAttendees)}
        icon={Users}
        title="Asistentes"
        subtitle={
          viewAttendees
            ? `${viewAttendees.training?.code ?? ""} · ${formatDay(viewAttendees.heldAt)} · ${statusLabel(viewAttendees.status)}`
            : undefined
        }
        onClose={() => setViewAttendees(null)}
        maxWidthClass="w-full max-w-[480px]"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium"
              onClick={() => setViewAttendees(null)}
            >
              Cerrar
            </button>
          </div>
        }
      >
        {viewAttendees ? (
          viewAttendees.attendees.length === 0 ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Esta sesión no tiene asistentes.
            </p>
          ) : (
            <ul className="m-0 flex max-h-[360px] list-none flex-col gap-1 overflow-y-auto p-0">
              {viewAttendees.attendees.map((a) => (
                <li key={a.id}>
                  {canOpenCrewFicha ? (
                    <Link
                      to={`/embarcados/${a.crewMemberId}`}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-2.5 py-2 hover:bg-[var(--color-nachipa-bg-page)]"
                      onClick={() => setViewAttendees(null)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-[var(--color-nachipa-title)]">
                          {a.crewMemberName}
                        </span>
                        <span className="block truncate text-[12px] text-[var(--color-nachipa-secondary)]">
                          {a.crewMemberRun}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] font-medium text-[var(--color-nachipa-primary)]">
                        Ver ficha
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-2.5 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-[var(--color-nachipa-title)]">
                          {a.crewMemberName}
                        </span>
                        <span className="block truncate text-[12px] text-[var(--color-nachipa-secondary)]">
                          {a.crewMemberRun}
                        </span>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : null}
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
              <Upload className="size-4" strokeWidth={1.5} aria-hidden />
              {uploading ? "Subiendo…" : "Subir"}
            </Button>
          </div>
        }
      >
        <form
          id="upload-session-certificate"
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            void onUploadCertificate(e);
          }}
        >
          {/* Botón con ícono: el input nativo no se entiende como acción de subir. */}
          <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]">
            <Upload
              className="size-4 shrink-0 text-[var(--color-icon-default)]"
              strokeWidth={1.5}
              aria-hidden
            />
            {uploadFile ? "Cambiar archivo" : "Elegir archivo"}
            <input
              type="file"
              accept=".pdf,application/pdf,image/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="sr-only"
              required={!uploadFile}
            />
          </label>
          {uploadFile ? (
            <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
              {uploadFile.name}
            </span>
          ) : (
            <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
              PDF o imagen del acta.
            </span>
          )}
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
