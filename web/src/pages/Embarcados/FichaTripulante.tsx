import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  Pencil,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { Link, useParams } from "react-router";

import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { TextField } from "../../components/TextField/TextField";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { listAreasRequest, type Area } from "../../lib/api/areas";
import {
  listBusinessesRequest,
  type Business,
} from "../../lib/api/businesses";
import {
  listCompetencyCertificatesRequest,
  type CompetencyCertificate,
} from "../../lib/api/competencyCertificates";
import {
  createCrewMemberMuelleRequest,
  createCrewMemberTravesiaRequest,
  deleteCrewMemberMuelleRequest,
  deleteCrewMemberTravesiaRequest,
  listCrewMemberMuellesRequest,
  listCrewMemberTravesiasRequest,
} from "../../lib/api/crewMemberAssignments";
import {
  getCrewMemberRequest,
  updateCrewMemberRequest,
  type CrewMember,
} from "../../lib/api/crewMembers";
import { listLocationsRequest, type Location } from "../../lib/api/locations";
import { listMuellesRequest, type Muelle } from "../../lib/api/muelles";
import { listRanksRequest, type Rank } from "../../lib/api/ranks";
import { listTravesiasRequest, type Travesia } from "../../lib/api/travesias";
import {
  formatBoardingBookDate,
  getBoardingBookUiState,
} from "../../lib/boardingBook";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { isRutValid, normalizeRut } from "../../lib/rut";
import { CrewDocumentsPanel } from "./CrewDocumentsPanel";
import { OfficerAssignmentsPanel } from "./OfficerAssignmentsPanel";

/** Form de edición (Figma D34 · Actualizar embarcado). */
type EditForm = {
  firstName: string;
  lastName: string;
  run: string;
  email: string;
  phone: string;
  nationality: string;
  direction: string;
  observation: string;
  boardingBookValidUntil: string;
  businessId: string;
  locationId: string;
  areaId: string;
  rankId: string;
  competencyCertificateId: string;
  state: boolean;
};

/** ISO timestamptz → valor de `<input type="date">`. */
function isoToDateInput(iso: string): string {
  return iso.slice(0, 10);
}

/** Fecha local YYYY-MM-DD → ISO para el contrato Zod. */
function dateInputToIso(date: string): string {
  return `${date}T00:00:00.000Z`;
}

/** Clase de selects del modal. */
const selectClass =
  "h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-nachipa-primary)]";

/** Tabs de la ficha (Figma D3). */
type FichaTab =
  | "cursos"
  | "capacitaciones"
  | "libreta"
  | "datos"
  | "documentos"
  | "historial";

/** Capitaliza para UI. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Nombre completo. */
function fullName(row: CrewMember): string {
  return `${displayName(row.firstName)} ${displayName(row.lastName)}`.trim();
}

/** Iniciales avatar. */
function initialsOf(row: CrewMember): string {
  const a = row.firstName.trim().charAt(0);
  const b = row.lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/**
 * Ficha del tripulante (Figma D3).
 * Cursos / cumplimiento: shell visual hasta Sección 8.
 * Tab Datos personales: datos reales del API.
 */
export function FichaTripulante() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";

  const [crew, setCrew] = useState<CrewMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FichaTab>("cursos");
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [certs, setCerts] = useState<CompetencyCertificate[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [muelles, setMuelles] = useState<Muelle[]>([]);
  const [travesias, setTravesias] = useState<Travesia[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [selectedMuelleIds, setSelectedMuelleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedTravesiaIds, setSelectedTravesiaIds] = useState<Set<string>>(
    () => new Set(),
  );
  /** assignmentId por muelleId / travesiaId para poder borrar al desmarcar. */
  const [muelleAssignmentById, setMuelleAssignmentById] = useState<
    Map<string, string>
  >(() => new Map());
  const [travesiaAssignmentById, setTravesiaAssignmentById] = useState<
    Map<string, string>
  >(() => new Map());
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    try {
      const [
        row,
        locs,
        areaList,
        certList,
        rankList,
        bizList,
        muelleList,
        travesiaList,
      ] = await Promise.all([
        getCrewMemberRequest(accessToken, id),
        listLocationsRequest(accessToken),
        listAreasRequest(accessToken),
        listCompetencyCertificatesRequest(accessToken),
        listRanksRequest(accessToken),
        isSuperadmin
          ? listBusinessesRequest(accessToken, 1, 100)
          : Promise.resolve({ items: [] as Business[] }),
        listMuellesRequest(accessToken, 1, 100),
        listTravesiasRequest(accessToken, 1, 100),
      ]);
      setCrew(row);
      setLocations(locs.items);
      setAreas(areaList.items);
      setCerts(certList.items);
      setRanks(rankList.items);
      setBusinesses(bizList.items);
      setMuelles(muelleList.items.filter((m) => m.state));
      setTravesias(travesiaList.items.filter((t) => t.state));
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cargar la ficha.",
        "danger",
      );
      setCrew(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, isSuperadmin, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const locationLabel = useMemo(() => {
    if (!crew) return "—";
    const loc = locations.find((l) => l.id === crew.locationId);
    return loc ? displayName(loc.name) : "—";
  }, [crew, locations]);

  const areaLabel = useMemo(() => {
    if (!crew?.areaId) return "—";
    const a = areas.find((x) => x.id === crew.areaId);
    return a ? displayName(a.name) : "—";
  }, [crew, areas]);

  const certLabel = useMemo(() => {
    if (!crew?.competencyCertificateId) return "—";
    const c = certs.find((x) => x.id === crew.competencyCertificateId);
    return c ? displayName(c.name) : "—";
  }, [crew, certs]);

  const bookState = crew
    ? getBoardingBookUiState(crew.boardingBookValidUntil)
    : "vencido";
  const bookDate = crew
    ? formatBoardingBookDate(crew.boardingBookValidUntil)
    : "—";

  /** Empresa del form (o la del tripulante / actor). */
  const formBusinessId = form
    ? isSuperadmin
      ? form.businessId
      : form.businessId || user?.businessId || ""
    : "";

  const formLocations = useMemo(() => {
    if (!formBusinessId) return locations;
    return locations.filter((l) => l.businessId === formBusinessId);
  }, [locations, formBusinessId]);

  const formAreas = useMemo(() => {
    if (!form) return [];
    return areas.filter((a) => {
      if (form.locationId && a.locationId !== form.locationId) return false;
      if (formBusinessId && a.businessId !== formBusinessId) return false;
      return true;
    });
  }, [areas, form, formBusinessId]);

  const formRanks = useMemo(() => {
    if (!formBusinessId) return ranks;
    return ranks.filter((r) => r.businessId === formBusinessId);
  }, [ranks, formBusinessId]);

  const formCerts = useMemo(() => {
    if (!formBusinessId) return certs;
    return certs.filter((c) => c.businessId === formBusinessId);
  }, [certs, formBusinessId]);

  const formMuelles = useMemo(() => {
    if (!formBusinessId) return muelles;
    return muelles.filter((m) => m.businessId === formBusinessId);
  }, [muelles, formBusinessId]);

  const formTravesias = useMemo(() => {
    if (!formBusinessId) return travesias;
    return travesias.filter((t) => t.businessId === formBusinessId);
  }, [travesias, formBusinessId]);

  const selectedCert = useMemo(() => {
    if (!form?.competencyCertificateId) return null;
    return (
      formCerts.find((c) => c.id === form.competencyCertificateId) ?? null
    );
  }, [form, formCerts]);

  const requiresOfficerAssignments = Boolean(
    selectedCert?.requiresMuelleTravesia,
  );

  /** Rellena el form y las asignaciones actuales. */
  async function openEdit() {
    if (!crew || !accessToken) return;
    setForm({
      firstName: displayName(crew.firstName),
      lastName: displayName(crew.lastName),
      run: crew.run,
      email: crew.email,
      phone: crew.phone ?? "",
      nationality: crew.nationality ?? "",
      direction: crew.direction ?? "",
      observation: crew.observation ?? "",
      boardingBookValidUntil: isoToDateInput(crew.boardingBookValidUntil),
      businessId: crew.businessId,
      locationId: crew.locationId,
      areaId: crew.areaId ?? "",
      rankId: crew.rankId ?? "",
      competencyCertificateId: crew.competencyCertificateId ?? "",
      state: crew.state,
    });
    try {
      const [muelleAsg, travesiaAsg] = await Promise.all([
        listCrewMemberMuellesRequest(accessToken, crew.id),
        listCrewMemberTravesiasRequest(accessToken, crew.id),
      ]);
      const muelleMap = new Map<string, string>();
      const muelleIds = new Set<string>();
      for (const row of muelleAsg.items) {
        muelleMap.set(row.muelleId, row.id);
        muelleIds.add(row.muelleId);
      }
      const travesiaMap = new Map<string, string>();
      const travesiaIds = new Set<string>();
      for (const row of travesiaAsg.items) {
        travesiaMap.set(row.travesiaId, row.id);
        travesiaIds.add(row.travesiaId);
      }
      setMuelleAssignmentById(muelleMap);
      setTravesiaAssignmentById(travesiaMap);
      setSelectedMuelleIds(muelleIds);
      setSelectedTravesiaIds(travesiaIds);
    } catch {
      setMuelleAssignmentById(new Map());
      setTravesiaAssignmentById(new Map());
      setSelectedMuelleIds(new Set());
      setSelectedTravesiaIds(new Set());
    }
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setForm(null);
    setSelectedMuelleIds(new Set());
    setSelectedTravesiaIds(new Set());
    setMuelleAssignmentById(new Map());
    setTravesiaAssignmentById(new Map());
  }

  /** Actualiza un campo; limpia FKs al cambiar empresa/nave/título. */
  function setField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      if (key === "businessId") {
        next.locationId = "";
        next.areaId = "";
        next.rankId = "";
        next.competencyCertificateId = "";
      }
      if (key === "locationId") {
        next.areaId = "";
      }
      return next;
    });
    if (key === "businessId" || key === "competencyCertificateId") {
      setSelectedMuelleIds(new Set());
      setSelectedTravesiaIds(new Set());
    }
  }

  function toggleMuelle(muelleId: string) {
    setSelectedMuelleIds((prev) => {
      const next = new Set(prev);
      if (next.has(muelleId)) next.delete(muelleId);
      else next.add(muelleId);
      return next;
    });
  }

  function toggleTravesia(travesiaId: string) {
    setSelectedTravesiaIds((prev) => {
      const next = new Set(prev);
      if (next.has(travesiaId)) next.delete(travesiaId);
      else next.add(travesiaId);
      return next;
    });
  }

  /** PATCH del tripulante + sync de muelles/travesías si aplica. */
  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !crew || !form) return;

    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast("Nombre y apellido son requeridos.", "danger");
      return;
    }
    if (!form.email.trim()) {
      showToast("El correo es requerido.", "danger");
      return;
    }
    if (!form.run.trim() || !isRutValid(form.run)) {
      showToast("El RUN no es válido.", "danger");
      return;
    }
    if (!form.boardingBookValidUntil) {
      showToast("La vigencia del libro es requerida.", "danger");
      return;
    }
    if (!form.locationId) {
      showToast("La nave / ubicación es requerida.", "danger");
      return;
    }
    if (isSuperadmin && !form.businessId) {
      showToast("La empresa es requerida.", "danger");
      return;
    }
    if (requiresOfficerAssignments) {
      if (selectedMuelleIds.size < 1 || selectedTravesiaIds.size < 1) {
        showToast(
          "Con este título hace falta al menos 1 muelle y 1 travesía.",
          "danger",
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const updated = await updateCrewMemberRequest(accessToken, crew.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        run: normalizeRut(form.run),
        phone: form.phone.trim() || null,
        nationality: form.nationality.trim() || null,
        direction: form.direction.trim() || null,
        observation: form.observation.trim() || null,
        boardingBookValidUntil: dateInputToIso(form.boardingBookValidUntil),
        locationId: form.locationId,
        areaId: form.areaId || null,
        rankId: form.rankId || null,
        competencyCertificateId: form.competencyCertificateId || null,
        state: form.state,
        ...(isSuperadmin ? { businessId: form.businessId } : {}),
      });

      // Sync asignaciones: el PATCH del título debe ir primero (API lo exige).
      const initialMuelleIds = new Set(muelleAssignmentById.keys());
      const initialTravesiaIds = new Set(travesiaAssignmentById.keys());

      if (requiresOfficerAssignments) {
        for (const muelleId of selectedMuelleIds) {
          if (!initialMuelleIds.has(muelleId)) {
            await createCrewMemberMuelleRequest(
              accessToken,
              crew.id,
              muelleId,
            );
          }
        }
        for (const muelleId of initialMuelleIds) {
          if (!selectedMuelleIds.has(muelleId)) {
            const assignmentId = muelleAssignmentById.get(muelleId);
            if (assignmentId) {
              await deleteCrewMemberMuelleRequest(
                accessToken,
                crew.id,
                assignmentId,
              );
            }
          }
        }
        for (const travesiaId of selectedTravesiaIds) {
          if (!initialTravesiaIds.has(travesiaId)) {
            await createCrewMemberTravesiaRequest(
              accessToken,
              crew.id,
              travesiaId,
            );
          }
        }
        for (const travesiaId of initialTravesiaIds) {
          if (!selectedTravesiaIds.has(travesiaId)) {
            const assignmentId = travesiaAssignmentById.get(travesiaId);
            if (assignmentId) {
              await deleteCrewMemberTravesiaRequest(
                accessToken,
                crew.id,
                assignmentId,
              );
            }
          }
        }
      } else {
        // Si el título ya no exige, limpia asignaciones previas.
        for (const assignmentId of muelleAssignmentById.values()) {
          await deleteCrewMemberMuelleRequest(
            accessToken,
            crew.id,
            assignmentId,
          );
        }
        for (const assignmentId of travesiaAssignmentById.values()) {
          await deleteCrewMemberTravesiaRequest(
            accessToken,
            crew.id,
            assignmentId,
          );
        }
      }

      setCrew(updated);
      showToast("Datos actualizados.", "success");
      closeEdit();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const tabs: { id: FichaTab; label: string }[] = [
    { id: "cursos", label: "Cursos (0)" },
    { id: "capacitaciones", label: "Capacitaciones" },
    { id: "libreta", label: "Libreta de embarque" },
    { id: "datos", label: "Datos personales" },
    { id: "documentos", label: "Documentos" },
    { id: "historial", label: "Historial" },
  ];

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f9fafc]">
      <Topbar
        breadcrumb={
          crew ? `Embarcados / ${fullName(crew)}` : "Embarcados / Ficha"
        }
        actions={<UserMenu />}
      />

      <div className="animate-enter flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        {loading ? (
          <p className="text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando ficha…
          </p>
        ) : !crew ? (
          <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-6">
            <p className="text-[13px] text-[var(--color-nachipa-secondary)]">
              Tripulante no encontrado.
            </p>
            <Link
              to="/embarcados"
              className="mt-3 inline-block text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
            >
              ← Volver a Embarcados
            </Link>
          </div>
        ) : (
          <>
            {/* Card · Tripulante (header Figma). */}
            <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5">
              <div className="flex flex-wrap items-start gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-status-info-bg)] text-[15px] font-semibold text-[var(--color-status-info-fg)]">
                  {initialsOf(crew)}
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="text-[20px] font-semibold leading-7 text-[var(--color-nachipa-title)]">
                    {fullName(crew)}
                  </h1>
                  <p className="mt-1 text-[13px] text-[var(--color-nachipa-secondary)]">
                    RUN {crew.run} · {certLabel} · {areaLabel}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full bg-[var(--color-status-info-bg)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--color-status-info-fg)]">
                      Embarcado · {locationLabel}
                    </span>
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium",
                        bookState === "vigente"
                          ? "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]"
                          : bookState === "por_vencer"
                            ? "bg-[var(--color-status-warning-bg,#ffedd5)] text-[var(--color-status-warning-fg,#c2410c)]"
                            : "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]",
                      ].join(" ")}
                    >
                      Libreta{" "}
                      {bookState === "vigente"
                        ? `vigente hasta ${bookDate}`
                        : bookState === "por_vencer"
                          ? `por vencer (${bookDate})`
                          : `vencida (${bookDate})`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                    onClick={() => {
                      void openEdit();
                    }}
                  >
                    <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
                    Editar datos
                  </button>
                  <Button
                    type="button"
                    size="medium"
                    className="!w-auto"
                    onClick={() =>
                      showToast(
                        "Asignar curso llega en la sección de cursos (S8).",
                        "info",
                      )
                    }
                  >
                    <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                    Asignar curso
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={[
                      "inline-flex h-9 items-center rounded-full px-3.5 text-[13px]",
                      active
                        ? "bg-[var(--color-status-info-bg,#e0f2fe)] font-medium text-[var(--color-nachipa-primary)]"
                        : "bg-white font-normal text-[var(--color-nachipa-secondary)] ring-1 ring-[var(--color-tremor-border)] hover:bg-[var(--color-nachipa-bg-page)]",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {tab === "cursos" ? (
              <>
                {/* Resumen cumplimiento (placeholder S8). */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5 lg:col-span-1">
                    <p className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                      Cumplimiento
                    </p>
                    <p className="mt-3 text-[28px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                      —
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--color-nachipa-secondary)]">
                      Cursos del título: disponible en Sección 8
                    </p>
                  </div>
                  <SummaryCard
                    icon={CalendarClock}
                    title="Por vencer"
                    value="0"
                    footer="Sin datos de cursos aún"
                    footerTone="muted"
                  />
                  <SummaryCard
                    icon={TriangleAlert}
                    title="Vencidos"
                    value="0"
                    footer="Todo al día"
                    footerTone="ok"
                  />
                  <SummaryCard
                    icon={ClipboardList}
                    title="Faltan"
                    value="0"
                    footer="Sin requisitos cargados"
                    footerTone="muted"
                  />
                </div>

                <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white">
                  <div className="border-b border-[var(--color-tremor-border)] px-4 py-3">
                    <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                      Cursos
                    </p>
                  </div>
                  <div className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]">
                    Todavía no migranos cursos por tripulante. La tabla y el
                    cumplimiento se conectan en la Sección 8.
                  </div>
                </div>
              </>
            ) : null}

            {tab === "datos" ? (
              <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5">
                <h2 className="text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                  Datos personales
                </h2>
                <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="RUN" value={crew.run} />
                  <Field label="Email" value={crew.email} />
                  <Field label="Teléfono" value={crew.phone ?? "—"} />
                  <Field
                    label="Nacionalidad"
                    value={crew.nationality ?? "—"}
                  />
                  <Field label="Dirección" value={crew.direction ?? "—"} />
                  <Field
                    label="Libro de embarque"
                    value={formatBoardingBookDate(crew.boardingBookValidUntil)}
                  />
                  <Field label="Nave / lugar" value={locationLabel} />
                  <Field label="Área" value={areaLabel} />
                  <Field label="Título marítimo" value={certLabel} />
                  <Field
                    label="Observación"
                    value={crew.observation ?? "—"}
                    className="sm:col-span-2"
                  />
                </dl>
                <div className="mt-5">
                  <Button
                    type="button"
                    size="small"
                    className="!w-auto"
                    onClick={() => {
                      void openEdit();
                    }}
                  >
                    <Pencil className="size-3.5" strokeWidth={1.5} aria-hidden />
                    Actualizar embarcado
                  </Button>
                </div>
              </div>
            ) : null}

            {tab === "documentos" && id ? (
              <CrewDocumentsPanel crewMemberId={id} />
            ) : null}

            {tab === "libreta" ? (
              <PlaceholderCard text="Libreta de embarque: detalle y hitos en un siguiente paso." />
            ) : null}
            {tab === "capacitaciones" ? (
              <PlaceholderCard text="Capacitaciones (Prevención) llegan con ese módulo." />
            ) : null}
            {tab === "historial" ? (
              <PlaceholderCard text="Bitácora / historial: Figma D31 — pendiente." />
            ) : null}

            <Link
              to="/embarcados"
              className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
            >
              ← Volver a Embarcados
            </Link>
          </>
        )}
      </div>

      <Modal
        open={editOpen && form !== null}
        icon={Pencil}
        title="Actualizar embarcado"
        subtitle="Datos personales, nave y vigencia del libro."
        onClose={closeEdit}
        maxWidthClass={
          requiresOfficerAssignments
            ? "w-full max-w-[880px] sm:w-[880px]"
            : "w-full max-w-[640px] sm:w-[640px]"
        }
        footer={
          <div className="flex flex-wrap items-center justify-end gap-3">
            {requiresOfficerAssignments &&
            (selectedMuelleIds.size < 1 || selectedTravesiaIds.size < 1) ? (
              <span className="mr-auto text-[12px] text-[var(--color-status-danger-fg)]">
                {selectedMuelleIds.size < 1 && selectedTravesiaIds.size < 1
                  ? "Falta 1 muelle y 1 travesía para guardar"
                  : selectedMuelleIds.size < 1
                    ? "Falta 1 muelle para guardar"
                    : "Falta 1 travesía para guardar"}
              </span>
            ) : null}
            <button
              type="button"
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
              onClick={closeEdit}
              disabled={submitting}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="embarcado-edit-form"
              className="!w-auto !font-medium"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        }
      >
        {form ? (
          <form
            id="embarcado-edit-form"
            className="flex flex-col gap-4"
            onSubmit={onSaveEdit}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Nombre"
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                required
              />
              <TextField
                label="Apellido"
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                required
              />
              <TextField
                label="RUN"
                value={form.run}
                onChange={(e) => setField("run", e.target.value)}
                required
              />
              <TextField
                label="Correo"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                required
              />
              <TextField
                label="Teléfono"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
              <TextField
                label="Nacionalidad"
                value={form.nationality}
                onChange={(e) => setField("nationality", e.target.value)}
              />
            </div>
            <TextField
              label="Dirección"
              value={form.direction}
              onChange={(e) => setField("direction", e.target.value)}
            />
            <TextField
              label="Vigencia libro de embarque"
              type="date"
              value={form.boardingBookValidUntil}
              onChange={(e) =>
                setField("boardingBookValidUntil", e.target.value)
              }
              required
            />

            {isSuperadmin ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Empresa
                </span>
                <select
                  className={selectClass}
                  value={form.businessId}
                  onChange={(e) => setField("businessId", e.target.value)}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {displayName(b.name)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Nave / ubicación
              </span>
              <select
                className={selectClass}
                value={form.locationId}
                onChange={(e) => setField("locationId", e.target.value)}
                required
              >
                <option value="">Seleccionar…</option>
                {formLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {displayName(l.name)}
                  </option>
                ))}
              </select>
            </label>

            {/* Título antes que cargo: el título define al embarcado; el cargo lo fija la empresa. */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Título marítimo
              </span>
              <select
                className={selectClass}
                value={form.competencyCertificateId}
                onChange={(e) =>
                  setField("competencyCertificateId", e.target.value)
                }
              >
                <option value="">Sin título</option>
                {formCerts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {displayName(c.name)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Área
                </span>
                <select
                  className={selectClass}
                  value={form.areaId}
                  onChange={(e) => setField("areaId", e.target.value)}
                >
                  <option value="">Sin área</option>
                  {formAreas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {displayName(a.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Cargo
                </span>
                <select
                  className={selectClass}
                  value={form.rankId}
                  onChange={(e) => setField("rankId", e.target.value)}
                >
                  <option value="">Sin cargo</option>
                  {formRanks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {displayName(r.name)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {requiresOfficerAssignments ? (
              <OfficerAssignmentsPanel
                muelles={formMuelles}
                travesias={formTravesias}
                selectedMuelleIds={selectedMuelleIds}
                selectedTravesiaIds={selectedTravesiaIds}
                onToggleMuelle={toggleMuelle}
                onToggleTravesia={toggleTravesia}
              />
            ) : null}

            {/* Documentos viven en la ficha (tab), no en este modal. */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page,#f9fafc)] px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Documentos del expediente
                </p>
                <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                  Vista previa y descarga en la ficha del tripulante
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                onClick={() => {
                  closeEdit();
                  setTab("documentos");
                }}
              >
                <FileText
                  className="size-3.5"
                  strokeWidth={1.5}
                  aria-hidden
                />
                Ir a documentos
              </button>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Observación
              </span>
              <textarea
                className="min-h-[84px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-nachipa-primary)]"
                value={form.observation}
                onChange={(e) => setField("observation", e.target.value)}
                placeholder="Notas internas del tripulante"
              />
              <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                Visible para administradores
              </span>
            </label>

            <label className="flex items-center gap-2 text-[13px] text-[var(--color-nachipa-title)]">
              <input
                type="checkbox"
                className="size-4 rounded border-[var(--color-tremor-border)]"
                checked={form.state}
                onChange={(e) => setField("state", e.target.checked)}
              />
              Embarcado activo
            </label>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

/** Campo lectura en datos personales. */
function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-nachipa-secondary)]">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] text-[var(--color-nachipa-title)]">
        {value}
      </dd>
    </div>
  );
}

/** Tarjeta KPI resumen de la ficha. */
function SummaryCard({
  icon: Icon,
  title,
  value,
  footer,
  footerTone,
}: {
  icon: typeof CalendarClock;
  title: string;
  value: string;
  footer: string;
  footerTone: "ok" | "muted";
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--color-nachipa-bg-page)]">
          <Icon
            className="size-3.5 text-[var(--color-icon-default)]"
            strokeWidth={1.5}
            aria-hidden
          />
        </span>
        <span className="text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
          {title}
        </span>
      </div>
      <p className="mt-3 text-[28px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
        {value}
      </p>
      <p
        className={[
          "mt-2 text-[12px]",
          footerTone === "ok"
            ? "text-[var(--color-status-success-fg)]"
            : "text-[var(--color-nachipa-secondary)]",
        ].join(" ")}
      >
        {footer}
      </p>
    </div>
  );
}

/** Placeholder de tabs sin datos aún. */
function PlaceholderCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white px-5 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]">
      {text}
    </div>
  );
}
