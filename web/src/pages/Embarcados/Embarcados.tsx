import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Download, MoreVertical, Plus, Ship } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableOutlineButton,
  DataTableSearch,
  DataTableSelect,
} from "../../components/DataTableCard/DataTableCard";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip, type StatusChipTone } from "../../components/StatusChip/StatusChip";
import { TableHeaderCell } from "../../components/TableHeaderCell/TableHeaderCell";
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
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
} from "../../lib/api/crewMemberAssignments";
import {
  createCrewMemberRequest,
  listCrewMembersRequest,
  type CrewMember,
} from "../../lib/api/crewMembers";
import { listLocationsRequest, type Location } from "../../lib/api/locations";
import { listMuellesRequest, type Muelle } from "../../lib/api/muelles";
import { listRanksRequest, type Rank } from "../../lib/api/ranks";
import { listTravesiasRequest, type Travesia } from "../../lib/api/travesias";
import {
  boardingBookStateLabel,
  daysUntilBoardingBookExpiry,
  formatBoardingBookDate,
  getBoardingBookUiState,
  type BoardingBookTab,
  type BoardingBookUiState,
} from "../../lib/boardingBook";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { downloadXls } from "../../lib/exportXls";
import { isRutValid, normalizeRut } from "../../lib/rut";
import { OfficerAssignmentsPanel } from "./OfficerAssignmentsPanel";

/** Form de alta: campos mínimos + opcionales de ficha. */
type CreateForm = {
  firstName: string;
  lastName: string;
  run: string;
  email: string;
  /** Fecha local YYYY-MM-DD → ISO al enviar. */
  boardingBookValidUntil: string;
  businessId: string;
  locationId: string;
  areaId: string;
  rankId: string;
  competencyCertificateId: string;
  observation: string;
};

/** Form vacío al abrir el modal. */
const EMPTY_CREATE: CreateForm = {
  firstName: "",
  lastName: "",
  run: "",
  email: "",
  boardingBookValidUntil: "",
  businessId: "",
  locationId: "",
  areaId: "",
  rankId: "",
  competencyCertificateId: "",
  observation: "",
};

/** Convierte input date a ISO 8601 (inicio del día UTC) para el contrato Zod. */
function dateInputToIso(date: string): string {
  return `${date}T00:00:00.000Z`;
}

/** Clase compartida de selects del modal. */
const selectClass =
  "h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-nachipa-primary)]";

/** Capitaliza palabras para tabla. */
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

/** Iniciales del avatar. */
function initialsOf(row: CrewMember): string {
  const a = row.firstName.trim().charAt(0);
  const b = row.lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/**
 * Tono de StatusChip según estado de vigencia del libro de embarque.
 * vigente → verde, por vencer → ámbar, vencido → rojo.
 */
function vigenciaTone(state: BoardingBookUiState): StatusChipTone {
  if (state === "vigente") return "success";
  if (state === "por_vencer") return "warning";
  return "danger";
}

/**
 * Embarcados — lista operativa (Figma D2 · Embarcados).
 * Cumplimiento de cursos: placeholder hasta Sección 8.
 */
export function Embarcados() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isSuperadmin = user?.internalRol === "superadmin";

  const [items, setItems] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<BoardingBookTab>("all");
  const [stateFilter, setStateFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [menuId, setMenuId] = useState<string | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [certs, setCerts] = useState<CompetencyCertificate[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [muelles, setMuelles] = useState<Muelle[]>([]);
  const [travesias, setTravesias] = useState<Travesia[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_CREATE);
  const [selectedMuelleIds, setSelectedMuelleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedTravesiaIds, setSelectedTravesiaIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [
        crew,
        locs,
        areaList,
        certList,
        rankList,
        bizList,
        muelleList,
        travesiaList,
      ] = await Promise.all([
        // API max limit = 100 (Zod); 94 migrados caben en una página.
        listCrewMembersRequest(accessToken, {
          page: 1,
          limit: 100,
          includeInactive: true,
        }),
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
      setItems(crew.items);
      setLocations(locs.items);
      setAreas(areaList.items);
      setCerts(certList.items);
      setRanks(rankList.items);
      setBusinesses(bizList.items);
      setMuelles(muelleList.items.filter((m) => m.state));
      setTravesias(travesiaList.items.filter((t) => t.state));
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los embarcados.",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, isSuperadmin, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const locationName = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of locations) m.set(l.id, l.name);
    return m;
  }, [locations]);

  const areaName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of areas) m.set(a.id, a.name);
    return m;
  }, [areas]);

  const certName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of certs) m.set(c.id, c.name);
    return m;
  }, [certs]);

  /** Conteos de tabs de vigencia. */
  const tabCounts = useMemo(() => {
    let vigente = 0;
    let porVencer = 0;
    let vencido = 0;
    for (const row of items) {
      const s = getBoardingBookUiState(row.boardingBookValidUntil);
      if (s === "vigente") vigente += 1;
      else if (s === "por_vencer") porVencer += 1;
      else vencido += 1;
    }
    return { all: items.length, vigente, por_vencer: porVencer, vencido };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (stateFilter === "active" && !row.state) return false;
      if (stateFilter === "inactive" && row.state) return false;
      if (tab !== "all") {
        const s = getBoardingBookUiState(row.boardingBookValidUntil);
        if (tab === "vigente" && s !== "vigente") return false;
        if (tab === "por_vencer" && s !== "por_vencer") return false;
        if (tab === "vencido" && s !== "vencido") return false;
      }
      if (!q) return true;
      const hay = `${row.firstName} ${row.lastName} ${row.run} ${row.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, tab, stateFilter]);

  /* Paginación cliente: resetea automáticamente cuando cambia filtered. */
  const { page, setPage, pageSize, setPageSize, pageCount, pageItems, total } =
    useClientTablePagination(filtered);

  /** Empresa efectiva para filtrar catálogos del modal. */
  const formBusinessId = isSuperadmin
    ? form.businessId
    : (user?.businessId ?? "");

  const formLocations = useMemo(() => {
    if (!formBusinessId) return locations;
    return locations.filter((l) => l.businessId === formBusinessId);
  }, [locations, formBusinessId]);

  const formAreas = useMemo(() => {
    return areas.filter((a) => {
      if (form.locationId && a.locationId !== form.locationId) return false;
      if (formBusinessId && a.businessId !== formBusinessId) return false;
      return true;
    });
  }, [areas, form.locationId, formBusinessId]);

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

  /** Título elegido: si exige muelles/travesías, el panel se expande. */
  const selectedCert = useMemo(
    () =>
      formCerts.find((c) => c.id === form.competencyCertificateId) ?? null,
    [formCerts, form.competencyCertificateId],
  );
  const requiresOfficerAssignments = Boolean(
    selectedCert?.requiresMuelleTravesia,
  );

  /** Actualiza un campo del form de alta. */
  function setField<K extends keyof CreateForm>(key: K, value: CreateForm[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Al cambiar empresa o nave, limpia FKs que dejan de aplicar.
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

  /** Marca / desmarca un muelle del checklist. */
  function toggleMuelle(id: string) {
    setSelectedMuelleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Marca / desmarca una travesía del checklist. */
  function toggleTravesia(id: string) {
    setSelectedTravesiaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setForm(EMPTY_CREATE);
    setSelectedMuelleIds(new Set());
    setSelectedTravesiaIds(new Set());
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setForm(EMPTY_CREATE);
    setSelectedMuelleIds(new Set());
    setSelectedTravesiaIds(new Set());
  }

  /** Alta: valida RUN y campos requeridos, crea y abre la ficha. */
  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;

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
      showToast("La vigencia del libro de embarque es requerida.", "danger");
      return;
    }
    if (isSuperadmin && !form.businessId) {
      showToast("La empresa es requerida.", "danger");
      return;
    }
    if (!form.locationId) {
      showToast("La nave / ubicación es requerida.", "danger");
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
      const created = await createCrewMemberRequest(accessToken, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        run: normalizeRut(form.run),
        boardingBookValidUntil: dateInputToIso(form.boardingBookValidUntil),
        locationId: form.locationId,
        ...(isSuperadmin ? { businessId: form.businessId } : {}),
        areaId: form.areaId || null,
        rankId: form.rankId || null,
        competencyCertificateId: form.competencyCertificateId || null,
        observation: form.observation.trim() || null,
        state: true,
      });
      // Asignaciones de oficial: solo si el título lo exige.
      if (requiresOfficerAssignments) {
        for (const muelleId of selectedMuelleIds) {
          await createCrewMemberMuelleRequest(
            accessToken,
            created.id,
            muelleId,
          );
        }
        for (const travesiaId of selectedTravesiaIds) {
          await createCrewMemberTravesiaRequest(
            accessToken,
            created.id,
            travesiaId,
          );
        }
      }
      showToast("Embarcado creado.", "success");
      closeCreate();
      await load();
      void navigate(`/embarcados/${created.id}`);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo crear el embarcado.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** Descarga CSV de los embarcados filtrados (no solo la página actual). */
  function onExport() {
    if (filtered.length === 0) {
      showToast("No hay filas para exportar.", "info");
      return;
    }
    downloadXls(
      filtered,
      [
        { header: "Nombre", value: (row) => fullName(row) },
        { header: "RUN", value: (row) => row.run },
        { header: "Estado", value: (row) => (row.state ? "Activo" : "Inactivo") },
        {
          header: "Vigencia libro",
          value: (row) => formatBoardingBookDate(row.boardingBookValidUntil),
        },
        {
          header: "Título marítimo",
          // Nombre del título desde el mapa; vacío si no tiene.
          value: (row) =>
            row.competencyCertificateId
              ? displayName(certName.get(row.competencyCertificateId) ?? "")
              : "",
        },
        {
          header: "Nave",
          value: (row) => displayName(locationName.get(row.locationId) ?? ""),
        },
        {
          header: "Área",
          value: (row) =>
            row.areaId ? displayName(areaName.get(row.areaId) ?? "") : "",
        },
      ],
      "embarcados",
    );
    showToast("Excel descargado.", "success");
  }

  const tabs: { id: BoardingBookTab; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: tabCounts.all },
    { id: "vigente", label: "Vigentes", count: tabCounts.vigente },
    { id: "por_vencer", label: "Por vencer", count: tabCounts.por_vencer },
    { id: "vencido", label: "Vencidos", count: tabCounts.vencido },
  ];

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f9fafc]">
      <Topbar
        breadcrumb="Embarcados"
        breadcrumbIcon={Ship}
        actions={<UserMenu />}
      />

      <div className="animate-enter flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden pb-6 pl-8 pr-8 pt-6">
        <PageHeader
          crumbs={[{ label: "Tripulación" }, { label: "Embarcados" }]}
          title="Embarcados"
          description="Personal a bordo de tus naves. El cumplimiento cuenta solo los cursos que exige su título marítimo."
        />

        {/* Tabs vigencia (Figma). */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  "inline-flex h-8 items-center gap-2 rounded-full px-3 text-[13px]",
                  active
                    ? "bg-[var(--color-status-info-bg,#e0f2fe)] font-medium text-[var(--color-nachipa-primary)]"
                    : "bg-white font-normal text-[var(--color-nachipa-secondary)] ring-1 ring-[var(--color-tremor-border)] hover:bg-[var(--color-nachipa-bg-page)]",
                ].join(" ")}
              >
                {t.label}
                <span
                  className={[
                    "rounded-full px-1.5 text-[11px] font-medium",
                    active
                      ? "bg-white/80 text-[var(--color-nachipa-primary)]"
                      : "bg-[var(--color-nachipa-bg-page)] text-[var(--color-nachipa-secondary)]",
                  ].join(" ")}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tarjeta DataTable Figma: toolbar interna + tabla scrolleable + pie. */}
        <DataTableCard
          toolbar={
            <>
              <DataTableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar embarcado"
              />
              <DataTableSelect
                value={stateFilter}
                onChange={(v) =>
                  setStateFilter(v as "all" | "active" | "inactive")
                }
                aria-label="Filtrar por estado"
              >
                <option value="all">Estado: todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </DataTableSelect>
              <DataTableOutlineButton onClick={onExport}>
                <Download className="size-3.5" strokeWidth={1.5} aria-hidden />
                Exportar
              </DataTableOutlineButton>
              <Button
                type="button"
                size="small"
                className="!w-auto"
                onClick={openCreate}
              >
                <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
                Agregar embarcado
              </Button>
            </>
          }
          footer={
            <TablePagination
              totalLabel={
                loading ? "Cargando…" : `${total} embarcados`
              }
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <table className="w-full min-w-[1100px] border-collapse text-left text-[12px]">
            <thead>
              <tr>
                {/* Columna checkbox: redondeada a la izquierda (Figma). */}
                <TableHeaderCell rounded="left" className="w-12">{null}</TableHeaderCell>
                <TableHeaderCell>Nombre</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell>Vigencia libro</TableHeaderCell>
                <TableHeaderCell>Título marítimo</TableHeaderCell>
                <TableHeaderCell>Nave</TableHeaderCell>
                <TableHeaderCell>Área</TableHeaderCell>
                <TableHeaderCell>Cumplimiento</TableHeaderCell>
                {/* Columna acciones: redondeada a la derecha (Figma). */}
                <TableHeaderCell rounded="right" align="right">
                  Acciones
                </TableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {!loading && pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                  >
                    No hay embarcados para mostrar.
                  </td>
                </tr>
              ) : null}
              {pageItems.map((row) => {
                const bookState = getBoardingBookUiState(
                  row.boardingBookValidUntil,
                );
                const daysLeft = daysUntilBoardingBookExpiry(
                  row.boardingBookValidUntil,
                );
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-tremor-border)] last:border-b-0 hover:bg-[var(--color-nachipa-bg-page)]"
                  >
                    <td className="h-[52px] px-3">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-[var(--color-tremor-border)]"
                        aria-label={`Seleccionar ${fullName(row)}`}
                      />
                    </td>
                    <td className="h-[52px] px-3">
                      <Link
                        to={`/embarcados/${row.id}`}
                        className="flex max-w-[280px] items-center gap-2.5"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-status-info-bg)] text-[11px] font-semibold text-[var(--color-status-info-fg)]">
                          {initialsOf(row)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-[var(--color-nachipa-primary)] hover:underline">
                            {fullName(row)}
                          </span>
                          <span className="block truncate text-[11px] text-[var(--color-nachipa-secondary)]">
                            {row.run}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="h-[52px] px-3">
                      {/* StatusChip Figma: success = activo, danger = inactivo. */}
                      <StatusChip tone={row.state ? "success" : "danger"}>
                        {row.state ? "Activo" : "Inactivo"}
                      </StatusChip>
                    </td>
                    <td className="h-[52px] px-3">
                      <div className="text-[var(--color-nachipa-body)]">
                        {formatBoardingBookDate(row.boardingBookValidUntil)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {/* StatusChip para vigencia: success/warning/danger según estado. */}
                        <StatusChip tone={vigenciaTone(bookState)}>
                          {boardingBookStateLabel(bookState)}
                        </StatusChip>
                        {daysLeft !== null ? (
                          <span className="text-[11px] text-[var(--color-nachipa-secondary)]">
                            {daysLeft < 0
                              ? `Venció hace ${Math.abs(daysLeft)} d`
                              : `Vence en ${daysLeft} d`}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="h-[52px] max-w-[220px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {row.competencyCertificateId
                        ? displayName(
                            certName.get(row.competencyCertificateId) ?? "—",
                          )
                        : "—"}
                    </td>
                    <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {displayName(locationName.get(row.locationId) ?? "—")}
                    </td>
                    <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {row.areaId
                        ? displayName(areaName.get(row.areaId) ?? "—")
                        : "—"}
                    </td>
                    <td className="h-[52px] px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-[90px] overflow-hidden rounded-full bg-[var(--color-nachipa-border-subtle)]">
                          <div className="h-full w-0 rounded-full bg-[var(--color-nachipa-secondary)]" />
                        </div>
                        <span className="text-[11px] tabular-nums text-[var(--color-nachipa-secondary)]">
                          —
                        </span>
                      </div>
                    </td>
                    <td className="relative h-[52px] px-3 text-right">
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-icon-default)] hover:bg-[var(--color-nachipa-bg-page)]"
                        aria-label="Acciones"
                        onClick={() =>
                          setMenuId((id) => (id === row.id ? null : row.id))
                        }
                      >
                        <MoreVertical
                          className="size-[18px]"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </button>
                      {menuId === row.id ? (
                        <div className="absolute right-3 top-11 z-10 min-w-[140px] rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                            onClick={() => {
                              setMenuId(null);
                              void navigate(`/embarcados/${row.id}`);
                            }}
                          >
                            Ver ficha
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableCard>
      </div>

      <Modal
        open={createOpen}
        icon={Plus}
        title="Agregar embarcado"
        subtitle="Datos básicos y vigencia del libro. El resto se completa en la ficha."
        onClose={closeCreate}
        maxWidthClass={
          requiresOfficerAssignments
            ? "w-full max-w-[880px] sm:w-[880px]"
            : "w-full max-w-[560px] sm:w-[560px]"
        }
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
              onClick={closeCreate}
              disabled={submitting}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="embarcado-create-form"
              className="!w-auto !font-medium"
              disabled={submitting}
            >
              {submitting ? "Creando…" : "Crear embarcado"}
            </Button>
          </div>
        }
      >
        <form
          id="embarcado-create-form"
          className="flex flex-col gap-4"
          onSubmit={onCreate}
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
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="RUN"
              value={form.run}
              onChange={(e) => setField("run", e.target.value)}
              placeholder="12.345.678-9"
              required
            />
            <TextField
              label="Correo"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              required
            />
          </div>
          <TextField
            label="Vigencia libro de embarque"
            type="date"
            value={form.boardingBookValidUntil}
            onChange={(e) => setField("boardingBookValidUntil", e.target.value)}
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
              disabled={isSuperadmin && !form.businessId}
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
              Título marítimo{" "}
              <span className="font-normal text-[var(--color-nachipa-secondary)]">
                opcional
              </span>
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
                Área{" "}
                <span className="font-normal text-[var(--color-nachipa-secondary)]">
                  opcional
                </span>
              </span>
              <select
                className={selectClass}
                value={form.areaId}
                onChange={(e) => setField("areaId", e.target.value)}
                disabled={!form.locationId}
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
                Cargo{" "}
                <span className="font-normal text-[var(--color-nachipa-secondary)]">
                  opcional
                </span>
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
        </form>
      </Modal>
    </div>
  );
}
