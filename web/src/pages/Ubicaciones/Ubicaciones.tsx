import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Download, MapPin, MoreVertical, Plus } from "lucide-react";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableOutlineButton,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { Modal } from "../../components/Modal/Modal";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TableHeaderCell } from "../../components/TableHeaderCell/TableHeaderCell";
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import {
  listBusinessesRequest,
  type Business,
} from "../../lib/api/businesses";
import {
  createLocationRequest,
  deleteLocationRequest,
  listLocationsRequest,
  updateLocationRequest,
  type Location,
  type LocationKind,
  type LocationWriteBody,
} from "../../lib/api/locations";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { downloadXls } from "../../lib/exportXls";
import { AreasPanel, type AreasPanelHandle } from "./AreasPanel";
import { MuellesPanel, type MuellesPanelHandle } from "./MuellesPanel";
import { PortsPanel, type PortsPanelHandle } from "./PortsPanel";
import { TravesiasPanel, type TravesiasPanelHandle } from "./TravesiasPanel";

/** Tabs de Flota y operación (Figma D16). */
type FlotaTab = "locations" | "areas" | "ports" | "muelles" | "travesias";

/** Opciones de tipo: valor API → etiqueta UI. */
const KIND_OPTIONS: ReadonlyArray<{ value: LocationKind; label: string }> = [
  { value: "vessel", label: "Nave" },
  { value: "office", label: "Oficina" },
  { value: "warehouse", label: "Bodega" },
  { value: "other", label: "Otro" },
];

/** Formulario create / edit. */
type FormState = {
  name: string;
  /** Solo superadmin al crear; vacío = sin elegir aún. */
  businessId: string;
  /** "" = sin clasificar (null en API). */
  kind: LocationKind | "";
  country: string;
  commune: string;
  city: string;
  phone: string;
  email: string;
  description: string;
  state: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  businessId: "",
  kind: "",
  country: "Chile",
  commune: "",
  city: "",
  phone: "",
  email: "",
  description: "",
  state: true,
};

/** Capitaliza nombre guardado en minúsculas. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Etiqueta de kind para la tabla. */
function kindLabel(kind: LocationKind | null): string {
  if (!kind) return "Sin clasificar";
  return KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
}

/**
 * Pantalla Flota y operación (lugares + áreas + puertos + muelles + travesías).
 * Tabs Figma D16; muelles con FK a puerto; travesías con cuota de pasadas.
 */
export function Ubicaciones() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";
  /** Admin o superadmin pueden CRUD (mismo criterio que la API). */
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";

  /** Tab activo de Flota. */
  const [tab, setTab] = useState<FlotaTab>("locations");
  /** Abre el modal de alta de áreas desde el PageHeader. */
  const areasPanelRef = useRef<AreasPanelHandle>(null);
  /** Abre el modal de alta de puertos desde el PageHeader. */
  const portsPanelRef = useRef<PortsPanelHandle>(null);
  /** Abre el modal de alta de muelles desde el PageHeader. */
  const muellesPanelRef = useRef<MuellesPanelHandle>(null);
  /** Abre el modal de alta de travesías desde el PageHeader. */
  const travesiasPanelRef = useRef<TravesiasPanelHandle>(null);  const [items, setItems] = useState<Location[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  /** Menú kebab abierto por fila. */
  const [menuId, setMenuId] = useState<string | null>(null);
  /** Dirección de orden por nombre en la tabla de lugares; null = sin ordenar. */
  const [nameSort, setNameSort] = useState<"asc" | "desc" | null>(null);

  /** Mapa businessId → nombre para la columna Empresa (superadmin). */
  const businessNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of businesses) {
      map.set(b.id, displayName(b.name));
    }
    return map;
  }, [businesses]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [locResult, bizResult] = await Promise.all([
        listLocationsRequest(accessToken),
        isSuperadmin
          ? listBusinessesRequest(accessToken)
          : Promise.resolve({ items: [] as Business[] }),
      ]);
      setItems(locResult.items);
      setBusinesses(bizResult.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los lugares de trabajo.",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, isSuperadmin, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = items;
    if (q) {
      rows = rows.filter((row) => {
        const biz = businessNameById.get(row.businessId) ?? "";
        return [row.name, kindLabel(row.kind), row.city, row.email, biz]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
    }
    // Orden por nombre si está activo en la tabla de lugares.
    if (nameSort) {
      rows = [...rows].sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, "es");
        return nameSort === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [items, search, businessNameById, nameSort]);

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    pageItems: locationPageItems,
    total: locationTotal,
  } = useClientTablePagination(filtered);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(row: Location) {
    setEditing(row);
    setMenuId(null);
    setForm({
      name: row.name,
      businessId: row.businessId,
      kind: row.kind ?? "",
      country: row.country ?? "Chile",
      commune: row.commune ?? "",
      city: row.city ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      description: row.description ?? "",
      state: row.state,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** Arma el body según create / edit y rol. */
  function buildBody(): LocationWriteBody {
    const kindValue: LocationKind | null = form.kind === "" ? null : form.kind;
    const base: LocationWriteBody = {
      name: form.name.trim(),
      kind: kindValue,
      country: form.country || undefined,
      commune: form.commune || undefined,
      city: form.city || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      description: form.description || undefined,
      state: form.state,
    };
    if (isSuperadmin && form.businessId) {
      base.businessId = form.businessId;
    }
    return base;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    if (!form.name.trim()) {
      showToast("El nombre es requerido.", "danger");
      return;
    }
    if (!editing && isSuperadmin && !form.businessId) {
      showToast("Elegí una empresa.", "danger");
      return;
    }

    setSubmitting(true);
    try {
      const body = buildBody();
      if (editing) {
        await updateLocationRequest(accessToken, editing.id, body);
        showToast("Lugar de trabajo actualizado.", "success");
      } else {
        await createLocationRequest(accessToken, body);
        showToast("Lugar de trabajo creado.", "success");
      }
      closeModal();
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(row: Location) {
    if (!accessToken || !canManage) return;
    setMenuId(null);
    const ok = window.confirm(
      `¿Eliminar «${displayName(row.name)}»? Quedará desactivado.`,
    );
    if (!ok) return;
    try {
      await deleteLocationRequest(accessToken, row.id);
      showToast("Lugar de trabajo eliminado.", "success");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar.",
        "danger",
      );
    }
  }

  /** Descarga CSV de los lugares de trabajo filtrados (no solo la página actual). */
  function onExportLocations() {
    if (filtered.length === 0) {
      showToast("No hay filas para exportar.", "info");
      return;
    }
    downloadXls(
      filtered,
      [
        { header: "Nombre", value: (row) => displayName(row.name) },
        { header: "Tipo", value: (row) => kindLabel(row.kind) },
        // Columna empresa: solo disponible y relevante para superadmin.
        ...(isSuperadmin
          ? [
              {
                header: "Empresa",
                value: (row: Location) =>
                  businessNameById.get(row.businessId) ?? "",
              },
            ]
          : []),
        { header: "Ciudad", value: (row) => row.city ?? "" },
        { header: "Estado", value: (row) => (row.state ? "Activo" : "Inactivo") },
      ],
      "lugares",
    );
    showToast("Excel descargado.", "success");
  }

  /** Select nativo: mismo focus sky que TextField (Figma border/focus). */
  const selectClass =
    "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f9fafc]">
      <Topbar
        breadcrumb="Flota y operación"
        breadcrumbIcon={MapPin}
        actions={<UserMenu />}
      />

      <div className="animate-enter flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden pb-6 pl-8 pr-12 pt-7">
        <PageHeader
          crumbs={[
            { label: "Configuración" },
            { label: "Flota y operación" },
          ]}
          title="Flota y operación"
          description="Naves y oficinas, áreas, muelles y travesías. Las áreas dependen del lugar de trabajo."
          actions={
            canManage ? (
              <Button
                type="button"
                className="!w-auto shrink-0"
                onClick={() => {
                  if (tab === "locations") openCreate();
                  else if (tab === "areas")
                    areasPanelRef.current?.openCreate();
                  else if (tab === "ports")
                    portsPanelRef.current?.openCreate();
                  else if (tab === "muelles")
                    muellesPanelRef.current?.openCreate();
                  else travesiasPanelRef.current?.openCreate();
                }}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                {tab === "locations"
                  ? "Nuevo lugar"
                  : tab === "areas"
                    ? "Nueva área"
                    : tab === "ports"
                      ? "Nuevo puerto"
                      : tab === "muelles"
                        ? "Nuevo muelle"
                        : "Nueva travesía"}
              </Button>
            ) : undefined
          }
        />

        {/* Tabs: Lugares · Áreas · Puertos · Muelles · Travesías. */}
        <div
          className="flex shrink-0 gap-1.5"
          role="tablist"
          aria-label="Secciones de flota"
        >
          {(
            [
              { id: "locations" as const, label: "Lugares de trabajo" },
              { id: "areas" as const, label: "Áreas" },
              { id: "ports" as const, label: "Puertos" },
              { id: "muelles" as const, label: "Muelles" },
              { id: "travesias" as const, label: "Travesías" },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={[
                  "inline-flex h-9 items-center rounded-[var(--radius-md)] px-3.5 text-[13px] font-medium",
                  active
                    ? "bg-[var(--color-nachipa-tab,#f4f4f5)] text-[var(--color-nachipa-title)]"
                    : "text-[var(--color-nachipa-secondary)] hover:bg-[var(--color-nachipa-bg-page)]",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "areas" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
            <AreasPanel ref={areasPanelRef} />
          </div>
        ) : null}

        {tab === "ports" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
            <PortsPanel ref={portsPanelRef} />
          </div>
        ) : null}

        {tab === "muelles" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
            <MuellesPanel ref={muellesPanelRef} />
          </div>
        ) : null}

        {tab === "travesias" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
            <TravesiasPanel ref={travesiasPanelRef} />
          </div>
        ) : null}

        {tab === "locations" ? (
          <DataTableCard
            toolbar={
              <>
                {/* Búsqueda en la toolbar (patrón DataTable Figma). */}
                <DataTableSearch
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar lugar de trabajo…"
                />
                <DataTableOutlineButton onClick={onExportLocations}>
                  <Download className="size-3.5" strokeWidth={1.5} aria-hidden />
                  Exportar
                </DataTableOutlineButton>
              </>
            }
            footer={
              <TablePagination
                totalLabel={
                  loading
                    ? "Cargando…"
                    : `${locationTotal} ${locationTotal === 1 ? "lugar" : "lugares"}`
                }
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                hidePageSize
              />
            }
          >
            <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-[12px]">
              <colgroup>
                <col style={{ width: isSuperadmin ? "22%" : "28%" }} />
                <col style={{ width: "14%" }} />
                {isSuperadmin ? <col style={{ width: "20%" }} /> : null}
                <col style={{ width: "16%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr>
                  {/* Encabezado Nombre: redondeado izquierdo, ordenable. */}
                  <TableHeaderCell
                    rounded="left"
                    sortable
                    sortDir={nameSort}
                    onSort={() =>
                      setNameSort((d) =>
                        d === "asc" ? "desc" : d === "desc" ? null : "asc",
                      )
                    }
                  >
                    Nombre
                  </TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  {isSuperadmin ? (
                    <TableHeaderCell>Empresa</TableHeaderCell>
                  ) : null}
                  <TableHeaderCell>Ciudad</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  {/* Acciones: redondeado derecho, alineado a la derecha. */}
                  <TableHeaderCell rounded="right" align="right">
                    Acciones
                  </TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {!loading && locationTotal === 0 ? (
                  <tr>
                    <td
                      colSpan={isSuperadmin ? 6 : 5}
                      className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                    >
                      No hay lugares de trabajo para mostrar.
                    </td>
                  </tr>
                ) : null}
                {locationPageItems.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-tremor-border)] last:border-b-0"
                  >
                    <td className="h-[52px] truncate px-3 font-medium text-[var(--color-nachipa-title)]">
                      {displayName(row.name)}
                    </td>
                    <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {kindLabel(row.kind)}
                    </td>
                    {isSuperadmin ? (
                      <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                        {businessNameById.get(row.businessId) ?? "—"}
                      </td>
                    ) : null}
                    <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {row.city || "—"}
                    </td>
                    <td className="h-[52px] px-3">
                      <StatusChip tone={row.state ? "success" : "danger"}>
                        {row.state ? "Activo" : "Inactivo"}
                      </StatusChip>
                    </td>
                    <td className="relative h-[52px] px-3 text-right">
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-icon-default)] hover:bg-[var(--color-nachipa-bg-page)]"
                            aria-label="Acciones"
                            onClick={() =>
                              setMenuId((id) =>
                                id === row.id ? null : row.id,
                              )
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
                                onClick={() => openEdit(row)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-status-danger-fg)] hover:bg-[var(--color-status-danger-bg)]"
                                onClick={() => void onDelete(row)}
                              >
                                Eliminar
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[var(--color-nachipa-secondary)]">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableCard>
        ) : null}
      </div>

      {/* Modal Figma D16 · 164:847 — 640×626, icon badge, grillas. */}
      <Modal
        open={modalOpen}
        icon={MapPin}
        title={editing ? "Editar lugar de trabajo" : "Nuevo lugar de trabajo"}
        subtitle={
          editing
            ? "Actualizá los datos del lugar de trabajo."
            : "Una nave u oficina de la empresa"
        }
        onClose={closeModal}
        maxWidthClass="w-full max-w-[640px] sm:w-[640px]"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              disabled={submitting}
              className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab,#f4f4f5)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="ubicacion-form"
              className="!w-auto !h-9"
              disabled={submitting}
            >
              {submitting
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Crear lugar"}
            </Button>
          </div>
        }
      >
        <form
          id="ubicacion-form"
          onSubmit={onSubmit}
          className="flex flex-col gap-6"
          noValidate
        >
          {/* Grupo · Datos generales (Figma 164:758). */}
          <fieldset className="flex flex-col gap-[12px] border-0 p-0">
            <legend className="mb-0 px-0 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-nachipa-secondary)]">
              Datos generales
            </legend>
            <div
              className={
                isSuperadmin
                  ? "grid gap-3 sm:grid-cols-2"
                  : "grid gap-3"
              }
            >
              {isSuperadmin ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                    Empresa {!editing ? "*" : ""}
                  </span>
                  <select
                    className={selectClass}
                    value={form.businessId}
                    onChange={(e) => setField("businessId", e.target.value)}
                    required={!editing}
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
                  Tipo
                </span>
                <select
                  className={selectClass}
                  value={form.kind}
                  onChange={(e) =>
                    setField("kind", e.target.value as LocationKind | "")
                  }
                >
                  <option value="">Sin clasificar</option>
                  {KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <TextField
              label="Nombre *"
              name="name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              required
              placeholder="Ej. Don Francisco"
            />
          </fieldset>

          {/* Grupo · Ubicación y contacto (Figma 164:827). */}
          <fieldset className="flex flex-col gap-[12px] border-0 p-0">
            <legend className="mb-0 px-0 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-nachipa-secondary)]">
              Ubicación y contacto
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField
                label="Ciudad"
                name="city"
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
                placeholder="Opcional"
              />
              <TextField
                label="Comuna"
                name="commune"
                value={form.commune}
                onChange={(e) => setField("commune", e.target.value)}
                placeholder="Opcional"
              />
              <TextField
                label="País"
                name="country"
                value={form.country}
                onChange={(e) => setField("country", e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Teléfono"
                name="phone"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="Opcional"
              />
              <TextField
                label="Correo"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="opcional@empresa.com"
              />
            </div>
          </fieldset>

          {/* Opción Activo (Figma 164:829) — toggle, no checkbox. */}
          {canManage ? (
            <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Activo
                </p>
                <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                  Disponible para embarcar tripulantes
                </p>
              </div>
              <Toggle
                checked={form.state}
                onChange={(next) => setField("state", next)}
                aria-label="Lugar activo"
              />
            </div>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
