import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Building2, MoreVertical, Plus } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableOutlineButton,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TableHeaderCell } from "../../components/TableHeaderCell/TableHeaderCell";
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import { ContractorFichaModal } from "./ContractorFichaModal";
import {
  listBusinessesRequest,
  type Business,
} from "../../lib/api/businesses";
import { createAccreditationRequest } from "../../lib/api/accreditations";
import {
  createContractorRequest,
  deleteContractorRequest,
  listContractorsRequest,
  updateContractorRequest,
  type ContractorAccreditationStatus,
  type ContractorOrganization,
  type ContractorRole,
} from "../../lib/api/contractors";
import { userHasPermission } from "../../lib/api/auth";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { downloadXls } from "../../lib/exportXls";

/** Capitaliza nombre guardado en minúsculas. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Etiqueta de role. */
function roleLabel(role: ContractorRole): string {
  return role === "permanent" ? "Permanente" : "Ocasional";
}

/** Chip de habilitación (Figma). */
function habLabel(status: ContractorAccreditationStatus | null): string {
  if (!status) return "Sin solicitud";
  switch (status) {
    case "approved":
      return "Habilitada";
    case "in_review":
      return "Por revisar";
    case "observed":
      return "Observada";
    case "rejected":
      return "Rechazada";
    case "invited":
      return "Invitada";
    case "pending":
      return "Pendiente";
    default:
      return status;
  }
}

/** Tono del chip HAB (Figma: Invitada = gris). */
function habTone(
  status: ContractorAccreditationStatus | null,
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (!status) return "neutral";
  switch (status) {
    case "approved":
      return "success";
    case "in_review":
      return "info";
    case "observed":
    case "pending":
      return "warning";
    case "invited":
      return "neutral";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

/** Iniciales tipo avatar Figma (ej. «Servicios Navales» → SN). */
function orgInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(spa|ltda|sa|de|del|la|el|y)$/i.test(w));
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

/**
 * «Última revisión» Figma: línea fecha + subtítulo de estado.
 */
function lastReviewParts(row: ContractorOrganization): {
  primary: string;
  secondary: string | null;
} {
  const hab = row.latestAccreditation;
  if (!hab) return { primary: "—", secondary: null };
  if (hab.status === "invited") {
    return { primary: "invitación enviada", secondary: null };
  }
  if (hab.reviewedAt) {
    let date = "—";
    try {
      date = new Date(hab.reviewedAt).toLocaleDateString("es-CL");
    } catch {
      date = "—";
    }
    const secondary =
      hab.status === "approved"
        ? "habilitada"
        : hab.status === "rejected"
          ? "rechazada"
          : hab.status === "observed"
            ? "observada"
            : null;
    return { primary: date, secondary };
  }
  if (hab.submittedAt) {
    const days = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(hab.submittedAt).getTime()) / 86_400_000,
      ),
    );
    return {
      primary: days === 0 ? "enviada hoy" : `enviada hace ${days} d`,
      secondary: hab.status === "observed" ? "observada" : null,
    };
  }
  if (hab.requestedAt) {
    try {
      return {
        primary: new Date(hab.requestedAt).toLocaleDateString("es-CL"),
        secondary: "solicitada",
      };
    } catch {
      return { primary: "—", secondary: null };
    }
  }
  return { primary: "—", secondary: null };
}

/** Personal: «N personas» o — (sin catálogo de personas aún). */
function personalLabel(count: number): string {
  if (count <= 0) return "—";
  return `${count} ${count === 1 ? "persona" : "personas"}`;
}

/** Form create / edit. */
type FormState = {
  name: string;
  rut: string;
  role: ContractorRole;
  specialty: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessId: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  rut: "",
  role: "occasional",
  specialty: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  businessId: "",
  active: true,
};

const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

const filterSelectClass =
  "h-8 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[12px] text-[var(--color-nachipa-body)] outline-none";

const outlineBtnClass =
  "inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/**
 * Listado Organizaciones (Figma P2 · P1).
 * Tabs con Habilitaciones; columnas RUT, razón, rol, personal, revisión, HAB.
 * Clic en org → ficha en modal (prototipo); página completa sigue disponible.
 */
export function ContractorsPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";
  const canRead = userHasPermission(user, "contractors", "read");
  const canReadHab = userHasPermission(user, "accreditations", "read");
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";

  const [items, setItems] = useState<ContractorOrganization[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | ContractorRole>("");
  const [habFilter, setHabFilter] = useState<
    "" | ContractorAccreditationStatus | "none"
  >("");
  const [menuId, setMenuId] = useState<string | null>(null);
  /** Selección de filas (checkbox Figma; sin acciones masivas aún). */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContractorOrganization | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  /** Figma P10: invitar contacto al crear (abre HAB + aviso). */
  const [inviteNow, setInviteNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] =
    useState<ContractorOrganization | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  /** Prototipo: ficha de org abierta en modal (id o null). */
  const [fichaOrgId, setFichaOrgId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setLoading(true);
    try {
      const result = await listContractorsRequest(accessToken, 1, 100, {
        role: roleFilter || undefined,
        accreditationStatus: habFilter || undefined,
      });
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar contratistas",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, canRead, roleFilter, habFilter, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!accessToken || !isSuperadmin) return;
    void listBusinessesRequest(accessToken, 1, 100)
      .then((res) => setBusinesses(res.items))
      .catch(() => setBusinesses([]));
  }, [accessToken, isSuperadmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.rut.toLowerCase().includes(q) ||
        (row.contactEmail ?? "").toLowerCase().includes(q) ||
        (row.contactName ?? "").toLowerCase().includes(q),
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

  /** Export XLS del listado filtrado. */
  function onExport() {
    if (filtered.length === 0) {
      showToast("No hay filas para exportar.", "info");
      return;
    }
    downloadXls(
      filtered,
      [
        { header: "RUT", value: (row) => row.rut },
        { header: "Razón social", value: (row) => displayName(row.name) },
        { header: "Rol", value: (row) => roleLabel(row.role) },
        {
          header: "Personal",
          value: (row) => personalLabel(row.personCount),
        },
        {
          header: "Habilitación",
          value: (row) =>
            habLabel(row.latestAccreditation?.status ?? null),
        },
        {
          header: "Última revisión",
          value: (row) => {
            const p = lastReviewParts(row);
            return p.secondary ? `${p.primary} ${p.secondary}` : p.primary;
          },
        },
        { header: "Email", value: (row) => row.contactEmail ?? "" },
      ],
      "contratistas",
    );
  }

  /** Marca/desmarca todas las filas de la página. */
  function toggleSelectAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of pageItems) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  /** Marca/desmarca una fila. */
  function toggleSelectRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, businessId: user?.businessId ?? "" });
    setInviteNow(true);
    setModalOpen(true);
  }

  function openEdit(row: ContractorOrganization) {
    setMenuId(null);
    setEditing(row);
    setForm({
      name: displayName(row.name),
      rut: row.rut,
      role: row.role,
      specialty: row.specialty ?? "",
      contactName: row.contactName ?? "",
      contactEmail: row.contactEmail ?? "",
      contactPhone: row.contactPhone ?? "",
      businessId: row.businessId,
      active: row.active,
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditing(null);
  }

  /** Abre la ficha en modal (prototipo) en lugar de navegar. */
  function openFichaModal(orgId: string) {
    setMenuId(null);
    setFichaOrgId(orgId);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || submitting) return;
    if (!form.name.trim()) {
      showToast("El nombre es requerido.", "danger");
      return;
    }
    if (!form.rut.trim()) {
      showToast("El RUT es requerido.", "danger");
      return;
    }
    if (isSuperadmin && !editing && !form.businessId) {
      showToast("Elegí la empresa.", "danger");
      return;
    }
    if (!editing && inviteNow && !form.contactEmail.trim()) {
      showToast("Con invitación activa, el correo de contacto es requerido.", "danger");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        rut: form.rut.trim(),
        role: form.role,
        specialty: form.specialty.trim() || null,
        contactName: form.contactName.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        active: form.active,
      };
      if (editing) {
        await updateContractorRequest(accessToken, editing.id, payload);
        showToast("Organización actualizada.", "success");
      } else {
        const created = await createContractorRequest(accessToken, {
          ...payload,
          ...(isSuperadmin ? { businessId: form.businessId } : {}),
        });
        // Figma P10 «Crear e invitar»: solicita documentación (HAB) al contacto.
        if (inviteNow) {
          await createAccreditationRequest(accessToken, {
            organizationId: created.id,
            message: form.contactName.trim()
              ? `Hola ${form.contactName.trim()}, favor subir la documentación del pack empresa para habilitación.`
              : "Favor subir la documentación del pack empresa para habilitación.",
          });
          showToast(
            "Organización creada e invitación de documentación enviada. El acceso al portal se invita desde la ficha (tab Usuarios, con RUN).",
            "success",
          );
        } else {
          showToast("Organización creada.", "success");
        }
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

  function askDeactivate(row: ContractorOrganization) {
    setMenuId(null);
    setPendingDeactivate(row);
  }

  async function confirmDeactivate() {
    if (!accessToken || !canManage || !pendingDeactivate || deactivating) {
      return;
    }
    setDeactivating(true);
    try {
      await deleteContractorRequest(accessToken, pendingDeactivate.id);
      showToast("Organización desactivada.", "success");
      setPendingDeactivate(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo desactivar.",
        "danger",
      );
    } finally {
      setDeactivating(false);
    }
  }

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Prevención"
          breadcrumbIcon={Building2}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            No tenés permiso para ver contratistas (contractors.read), o el
            módulo está apagado en la empresa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Prevención"
        breadcrumbIcon={Building2}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Contratistas" },
          ]}
          title="Contratistas"
          description="Empresas externas que trabajan en la flota. Solo las habilitadas pueden recibir permisos de trabajo."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <DataTableOutlineButton
                onClick={() =>
                  showToast("Importar llega en un paso siguiente.", "info")
                }
              >
                Importar
              </DataTableOutlineButton>
              {canManage ? (
                <Button
                  type="button"
                  size="medium"
                  className="!w-auto"
                  onClick={openCreate}
                >
                  <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                  Nueva organización
                </Button>
              ) : null}
            </div>
          }
        />

        {/* Tabs Figma: Organizaciones | Habilitaciones */}
        <div
          role="tablist"
          className="flex gap-1 border-b border-[var(--color-tremor-border)]"
        >
          <span
            role="tab"
            aria-selected
            className="border-b-2 border-[var(--color-nachipa-primary)] px-3 py-2 text-[13px] font-medium text-[var(--color-nachipa-title)]"
          >
            Organizaciones
            <span className="ml-1.5 text-[var(--color-nachipa-secondary)]">
              {items.length}
            </span>
          </span>
          {canReadHab ? (
            <Link
              to="/prevencion/habilitaciones"
              role="tab"
              className="px-3 py-2 text-[13px] font-medium text-[var(--color-nachipa-secondary)] hover:text-[var(--color-nachipa-title)]"
            >
              Habilitaciones
            </Link>
          ) : null}
        </div>

        <DataTableCard
          toolbar={
            <div className="flex w-full flex-wrap items-center gap-2">
              <div className="min-w-[200px] flex-1">
                <DataTableSearch
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar por RUT o razón social…"
                />
              </div>
              <select
                className={filterSelectClass}
                value={habFilter}
                aria-label="Filtro habilitación"
                onChange={(e) =>
                  setHabFilter(
                    e.target.value as "" | ContractorAccreditationStatus | "none",
                  )
                }
              >
                <option value="">Habilitación: todas</option>
                <option value="approved">Habilitada</option>
                <option value="in_review">Por revisar</option>
                <option value="observed">Observada</option>
                <option value="pending">Pendiente</option>
                <option value="invited">Invitada</option>
                <option value="rejected">Rechazada</option>
                <option value="none">Sin solicitud</option>
              </select>
              <select
                className={filterSelectClass}
                value={roleFilter}
                aria-label="Filtro rol"
                onChange={(e) =>
                  setRoleFilter(e.target.value as "" | ContractorRole)
                }
              >
                <option value="">Rol: todos</option>
                <option value="permanent">Permanente</option>
                <option value="occasional">Ocasional</option>
              </select>
              <DataTableOutlineButton onClick={onExport}>
                Exportar
              </DataTableOutlineButton>
            </div>
          }
          footer={
            <TablePagination
              totalLabel={
                loading
                  ? "Cargando…"
                  : `${total} ${total === 1 ? "organización" : "organizaciones"}`
              }
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
            <thead>
              <tr>
                <TableHeaderCell rounded="left" className="w-10">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-[var(--color-tremor-border)]"
                    aria-label="Seleccionar todas"
                    checked={
                      pageItems.length > 0 &&
                      pageItems.every((r) => selectedIds.has(r.id))
                    }
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </TableHeaderCell>
                <TableHeaderCell>RUT</TableHeaderCell>
                <TableHeaderCell>Razón social</TableHeaderCell>
                <TableHeaderCell>Rol</TableHeaderCell>
                <TableHeaderCell>Personal</TableHeaderCell>
                <TableHeaderCell>Última revisión</TableHeaderCell>
                <TableHeaderCell>Habilitación</TableHeaderCell>
                <TableHeaderCell rounded="right" align="right">
                  Acciones
                </TableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    No hay organizaciones con esos filtros.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => {
                  const habStatus = row.latestAccreditation?.status ?? null;
                  const review = lastReviewParts(row);
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--color-tremor-border)] hover:bg-[var(--color-nachipa-bg-page)]"
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-[var(--color-tremor-border)]"
                          aria-label={`Seleccionar ${row.rut}`}
                          checked={selectedIds.has(row.id)}
                          onChange={(e) =>
                            toggleSelectRow(row.id, e.target.checked)
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium tabular-nums text-[var(--color-nachipa-title)]">
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => openFichaModal(row.id)}
                        >
                          {row.rut}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 text-left hover:opacity-90"
                          onClick={() => openFichaModal(row.id)}
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-status-info-bg,#e0f2fe)] text-[11px] font-semibold text-[var(--color-status-info-fg,#0369a1)]">
                            {orgInitials(row.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-[var(--color-nachipa-title)]">
                              {displayName(row.name)}
                            </span>
                            {row.contactEmail ? (
                              <span className="block truncate text-[12px] text-[var(--color-nachipa-secondary)]">
                                {row.contactEmail}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                        {roleLabel(row.role)}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                        {personalLabel(row.personCount)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block text-[var(--color-nachipa-body)]">
                          {review.primary}
                        </span>
                        {review.secondary ? (
                          <span className="block text-[12px] text-[var(--color-nachipa-secondary)]">
                            {review.secondary}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusChip tone={habTone(habStatus)}>
                          {habLabel(habStatus)}
                        </StatusChip>
                      </td>
                      <td className="relative px-3 py-2.5 text-right">
                        {canManage ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nachipa-secondary)] hover:bg-white hover:text-[var(--color-nachipa-title)]"
                              aria-label="Acciones"
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
                              <div className="absolute right-3 z-10 mt-1 min-w-[140px] rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white py-1 shadow-sm">
                                <button
                                  type="button"
                                  className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                                  onClick={() => openFichaModal(row.id)}
                                >
                                  Ver ficha
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                                  onClick={() => openEdit(row)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-status-danger-fg)] hover:bg-[var(--color-nachipa-bg-page)]"
                                  onClick={() => askDeactivate(row)}
                                >
                                  Desactivar
                                </button>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <button
                            type="button"
                            className="text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                            onClick={() => openFichaModal(row.id)}
                          >
                            Ver
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </DataTableCard>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        icon={editing ? Building2 : undefined}
        title={editing ? "Editar organización" : "Nueva organización"}
        subtitle={
          editing
            ? "Datos de la empresa externa."
            : "Das de alta una empresa externa e invitas a su contacto."
        }
        maxWidthClass={
          editing
            ? "w-full max-w-[520px] sm:w-[520px]"
            : "w-full max-w-[640px] sm:w-[640px]"
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={closeModal}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="contractor-form"
              size="medium"
              className="!w-auto"
              disabled={submitting}
            >
              {submitting
                ? "Guardando…"
                : editing
                  ? "Guardar"
                  : inviteNow
                    ? "Crear e invitar"
                    : "Crear"}
            </Button>
          </div>
        }
      >
        <form
          id="contractor-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => void onSubmit(e)}
        >
          {isSuperadmin && !editing ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Empresa (tenant)
              </span>
              <select
                className={selectClass}
                required
                value={form.businessId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, businessId: e.target.value }))
                }
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

          {editing ? (
            <>
              <TextField
                label="Razón social"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
              <TextField
                label="RUT"
                value={form.rut}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rut: e.target.value }))
                }
                required
                disabled
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Rol
                </span>
                <select
                  className={selectClass}
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      role: e.target.value as ContractorRole,
                    }))
                  }
                >
                  <option value="occasional">Ocasional</option>
                  <option value="permanent">Permanente</option>
                </select>
              </label>
              <TextField
                label="Especialidad"
                value={form.specialty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, specialty: e.target.value }))
                }
              />
              <TextField
                label="Contacto (nombre)"
                value={form.contactName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactName: e.target.value }))
                }
              />
              <TextField
                label="Correo de contacto"
                type="email"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactEmail: e.target.value }))
                }
              />
              <TextField
                label="Teléfono"
                value={form.contactPhone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactPhone: e.target.value }))
                }
              />
              <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-table-head-bg,#f8f9fb)] px-3.5 py-3">
                <span className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                  Activa
                </span>
                <Toggle
                  checked={form.active}
                  onChange={(next) => setForm((f) => ({ ...f, active: next }))}
                  aria-label="Organización activa"
                />
              </div>
            </>
          ) : (
            <>
              {/* Figma P10: grilla 2×3 */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
                <TextField
                  label="Razón social"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Soldaduras Calbuco SpA"
                  required
                />
                <TextField
                  label="RUT"
                  value={form.rut}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rut: e.target.value }))
                  }
                  placeholder="76.778.903-5"
                  required
                />
                <TextField
                  label="Especialidad"
                  value={form.specialty}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, specialty: e.target.value }))
                  }
                  placeholder="Soldadura"
                />
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                    Rol
                  </span>
                  <select
                    className={selectClass}
                    value={form.role}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        role: e.target.value as ContractorRole,
                      }))
                    }
                  >
                    <option value="occasional">Ocasional</option>
                    <option value="permanent">Permanente</option>
                  </select>
                </label>
                <TextField
                  label="Contacto (nombre)"
                  value={form.contactName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactName: e.target.value }))
                  }
                  placeholder="Camila Rojas"
                />
                <TextField
                  label="Correo de contacto"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactEmail: e.target.value }))
                  }
                  placeholder="contacto@soldacalbuco.cl"
                  required={inviteNow}
                />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-[12px] border border-[var(--color-tremor-border)] bg-white px-3.5 py-3">
                <div className="min-w-0">
                  <p className="m-0 text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                    Invitar al contacto ahora
                  </p>
                  <p className="m-0 mt-0.5 text-[12px] text-[var(--color-nachipa-secondary)]">
                    Recibe un link de un solo uso que vence en 72 h
                  </p>
                </div>
                <Toggle
                  checked={inviteNow}
                  onChange={setInviteNow}
                  aria-label="Invitar al contacto ahora"
                />
              </div>

              {inviteNow ? (
                <div className="rounded-[10px] bg-[var(--color-status-info-bg,#e0f2fe)] px-3.5 py-2.5">
                  <p className="m-0 text-[12px] leading-5 text-[var(--color-status-info-fg,#0369a1)]">
                    La organización queda «Invitada» y aún no puede recibir
                    permisos de trabajo hasta ser habilitada.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(pendingDeactivate)}
        onClose={() => {
          if (!deactivating) setPendingDeactivate(null);
        }}
        title="Desactivar organización"
        subtitle={
          pendingDeactivate
            ? `¿Desactivar «${displayName(pendingDeactivate.name)}» (${pendingDeactivate.rut})?`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deactivating}
              onClick={() => setPendingDeactivate(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={deactivating}
              onClick={() => void confirmDeactivate()}
            >
              {deactivating ? "Desactivando…" : "Desactivar"}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[13px] text-[var(--color-nachipa-body)]">
          Soft delete: queda fuera del listado activo.
        </p>
      </Modal>

      <ContractorFichaModal
        organizationId={fichaOrgId}
        onClose={() => setFichaOrgId(null)}
      />
    </div>
  );
}
