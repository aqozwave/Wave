import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Bell, Plus } from "lucide-react";
import { useNavigate } from "react-router";
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
  listContractorsRequest,
  type ContractorOrganization,
} from "../../lib/api/contractors";
import {
  listLocationsRequest,
  type Location,
  type LocationKind,
} from "../../lib/api/locations";
import {
  listPermitTypesRequest,
  type PermitType,
} from "../../lib/api/permitTypes";
import { userHasPermission } from "../../lib/api/auth";
import {
  createWorkNoticeRequest,
  deleteWorkNoticeRequest,
  listWorkNoticesRequest,
  type WorkNotice,
} from "../../lib/api/workNotices";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { WorkPermitCreateModal } from "./WorkPermitCreateModal";

/** Capitaliza nombre. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Etiqueta corta del tipo de lugar (mismo copy que Ubicaciones). */
function locationKindLabel(kind: LocationKind | null): string {
  if (kind === "vessel") return "Nave";
  if (kind === "office") return "Oficina";
  if (kind === "warehouse") return "Bodega";
  if (kind === "other") return "Otro";
  return "Lugar";
}

/** Fecha dd-mm-yyyy. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

/** Chip HAB de la org (solo lectura; no es toggle). */
function habLabel(
  status: WorkNotice["organization"]["latestAccreditationStatus"],
): string {
  if (!status) return "Sin HAB";
  switch (status) {
    case "approved":
      return "Habilitada";
    case "rejected":
      return "Rechazada";
    case "in_review":
      return "Por revisar";
    case "observed":
      return "Observada";
    case "pending":
    case "invited":
      return "Pendiente";
    default:
      return status;
  }
}

/** Tono chip HAB. */
function habTone(
  status: WorkNotice["organization"]["latestAccreditationStatus"],
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (!status) return "neutral";
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "in_review") return "info";
  return "warning";
}

const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

const outlineBtnClass =
  "inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/**
 * Bandeja de avisos de trabajo (P4 · AT1) + modal AT2.
 * Área solicitante = área del usuario; sin área no se crea.
 * Sin toggle de HAB: el estado sale de la org elegida.
 */
export function WorkNoticesPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const canRead = userHasPermission(user, "work_notices", "read");
  const canCreate = userHasPermission(user, "work_notices", "create");
  const canDelete = userHasPermission(user, "work_notices", "deactivate");
  const canCreatePermit = userHasPermission(user, "work_permits", "create");
  /** Crear PT es solo staff (no portal). */
  const isStaff = !user?.organizationId;

  const [items, setItems] = useState<WorkNotice[]>([]);
  const [orgs, setOrgs] = useState<ContractorOrganization[]>([]);
  const [permitTypes, setPermitTypes] = useState<PermitType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  /** Aviso preseleccionado para el modal P13. */
  const [permitFromNotice, setPermitFromNotice] = useState<WorkNotice | null>(
    null,
  );
  /** Confirmación soft-delete. */
  const [deleteRow, setDeleteRow] = useState<WorkNotice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [permitTypeId, setPermitTypeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [tentativeDate, setTentativeDate] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setLoading(true);
    try {
      const result = await listWorkNoticesRequest(accessToken, 1, 100);
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudieron cargar avisos",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, canRead, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Catálogos del modal AT2: cada request independiente.
   * Si una falla (p. ej. sin permit_types.read), no vacía las otras.
   */
  useEffect(() => {
    if (!accessToken || !canCreate) return;

    void listContractorsRequest(accessToken, 1, 100, { active: true })
      .then((o) => setOrgs(o.items))
      .catch((err) => {
        setOrgs([]);
        showToast(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar contratistas",
          "danger",
        );
      });

    void listPermitTypesRequest(accessToken, 1, 100, { active: true })
      .then((p) => setPermitTypes(p.items))
      .catch((err) => {
        setPermitTypes([]);
        showToast(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar tipos de permiso",
          "danger",
        );
      });

    // Cualquier lugar de trabajo activo (nave, oficina, bodega u otro).
    void listLocationsRequest(accessToken, 1, 100)
      .then((l) => setLocations(l.items.filter((loc) => loc.state)))
      .catch((err) => {
        setLocations([]);
        showToast(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar lugares de trabajo",
          "danger",
        );
      });
  }, [accessToken, canCreate, showToast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        row.organization.name.toLowerCase().includes(q) ||
        row.organization.rut.toLowerCase().includes(q) ||
        row.permitType.name.toLowerCase().includes(q) ||
        row.location.name.toLowerCase().includes(q),
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

  /** Org elegida en el modal (para contacto y chip HAB). */
  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === organizationId) ?? null,
    [orgs, organizationId],
  );

  /** Abre AT2 con defaults. */
  function openCreate() {
    setOrganizationId("");
    setPermitTypeId("");
    setLocationId("");
    setTentativeDate("");
    setDurationDays("");
    setDescription("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setCreateOpen(true);
  }

  /** Al elegir org, completa contacto desde la ficha. */
  function onPickOrg(id: string) {
    setOrganizationId(id);
    const org = orgs.find((o) => o.id === id);
    if (!org) return;
    setContactName(org.contactName ?? "");
    setContactEmail(org.contactEmail ?? "");
    setContactPhone(org.contactPhone ?? "");
  }

  /** Abre P13b con el aviso pendiente. */
  function openCreatePermit(row: WorkNotice) {
    if (!canCreatePermit || !isStaff) return;
    if (row.workPermit || row.status !== "pending") return;
    setPermitFromNotice(row);
  }

  /** POST aviso. */
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || submitting) return;
    if (!organizationId || !permitTypeId || !locationId || !tentativeDate) {
      showToast("Completá org, tipo, lugar y fecha.", "danger");
      return;
    }
    const daysRaw = durationDays.trim();
    let estimatedDurationDays: number | null = null;
    if (daysRaw) {
      const n = Number(daysRaw);
      if (!Number.isInteger(n) || n < 1) {
        showToast("Duración debe ser un número entero de días.", "danger");
        return;
      }
      estimatedDurationDays = n;
    }
    setSubmitting(true);
    try {
      await createWorkNoticeRequest(accessToken, {
        organizationId,
        permitTypeId,
        locationId,
        tentativeDate,
        estimatedDurationDays,
        description: description.trim() || null,
        contactName: contactName.trim() || null,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        notifyByEmail: true,
      });
      showToast("Aviso enviado a Prevención.", "success");
      setCreateOpen(false);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo crear el aviso.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** Soft-delete aviso (+ PT vinculado si hay). */
  async function onConfirmDelete() {
    if (!accessToken || !deleteRow || deleting) return;
    setDeleting(true);
    try {
      await deleteWorkNoticeRequest(accessToken, deleteRow.id);
      showToast(`${deleteRow.code} eliminado.`, "success");
      setDeleteRow(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar el aviso.",
        "danger",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Prevención"
          breadcrumbIcon={Bell}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            No tenés permiso work_notices.read, o el módulo work_permits está
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
        breadcrumbIcon={Bell}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Avisos de trabajo" },
          ]}
          title="Avisos de trabajo"
          description="Informa a Prevención qué trabajos y empresas van a un lugar de trabajo. La habilitación se lee de la organización (sin toggle)."
          actions={
            canCreate ? (
              <Button
                type="button"
                size="medium"
                className="!w-auto"
                onClick={openCreate}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                Nuevo aviso de trabajo
              </Button>
            ) : null
          }
        />

        <DataTableCard
          toolbar={
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar por aviso o empresa…"
            />
          }
          footer={
            <TablePagination
              totalLabel={
                loading
                  ? "Cargando…"
                  : `${total} ${total === 1 ? "aviso" : "avisos"}`
              }
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <table className="w-full min-w-[940px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
                <th className="px-3 py-2.5">Aviso</th>
                <th className="px-3 py-2.5">Empresa</th>
                <th className="px-3 py-2.5">Trabajo</th>
                <th className="px-3 py-2.5">Lugar</th>
                <th className="px-3 py-2.5">Área</th>
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5">Habilitación</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
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
                    No hay avisos. Creá uno con «Nuevo aviso de trabajo».
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
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {row.permitType.code} · {displayName(row.permitType.name)}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {displayName(row.location.name)}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {displayName(row.requestingArea.name)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                      {formatDate(row.tentativeDate)}
                      {row.estimatedDurationDays
                        ? ` · ${row.estimatedDurationDays} d`
                        : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip
                        tone={habTone(
                          row.organization.latestAccreditationStatus,
                        )}
                      >
                        {habLabel(row.organization.latestAccreditationStatus)}
                      </StatusChip>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip
                        tone={
                          row.status === "pending"
                            ? "info"
                            : row.status === "linked"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {row.status === "pending"
                          ? "Enviado"
                          : row.status === "linked"
                            ? "Con permiso"
                            : "Anulado"}
                      </StatusChip>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex flex-wrap items-center justify-end gap-2">
                        {row.workPermit ? (
                          <span className="text-[12px] font-medium tabular-nums text-[var(--color-nachipa-primary)]">
                            {row.workPermit.code}
                          </span>
                        ) : canCreatePermit &&
                          isStaff &&
                          row.status === "pending" ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                            onClick={() => openCreatePermit(row)}
                          >
                            Crear permiso
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-secondary)] hover:text-[var(--color-status-danger-fg,#b91c1c)] hover:underline"
                            onClick={() => setDeleteRow(row)}
                          >
                            Eliminar
                          </button>
                        ) : !row.workPermit &&
                          !(
                            canCreatePermit &&
                            isStaff &&
                            row.status === "pending"
                          ) ? (
                          <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                            —
                          </span>
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

      <Modal
        open={createOpen}
        onClose={() => {
          if (!submitting) setCreateOpen(false);
        }}
        icon={Bell}
        title="Nuevo aviso de trabajo"
        subtitle="Informás a Prevención qué empresa y qué trabajo van a un lugar"
        maxWidthClass="w-full max-w-[560px] sm:w-[560px]"
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
              form="work-notice-create-form"
              size="medium"
              className="!w-auto"
              disabled={submitting}
            >
              {submitting ? "Enviando…" : "Enviar aviso a Prevención"}
            </Button>
          </div>
        }
      >
        <form
          id="work-notice-create-form"
          className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto"
          onSubmit={(e) => void onCreate(e)}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Empresa contratista
            </span>
            <select
              className={selectClass}
              required
              value={organizationId}
              onChange={(e) => onPickOrg(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rut} · {displayName(o.name)}
                </option>
              ))}
            </select>
            {selectedOrg ? (
              <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                Habilitación:{" "}
                {habLabel(
                  selectedOrg.latestAccreditation?.status ?? null,
                )}{" "}
                (se lee de la org; no se elige acá)
              </span>
            ) : null}
          </label>

          <TextField
            label="Contacto (nombre)"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <TextField
            label="Contacto (correo)"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <TextField
            label="Contacto (teléfono)"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Tipo de permiso
            </span>
            <select
              className={selectClass}
              required
              value={permitTypeId}
              onChange={(e) => setPermitTypeId(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {permitTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {displayName(t.name)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Lugar de trabajo
            </span>
            <select
              className={selectClass}
              required
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {locationKindLabel(l.kind)} · {displayName(l.name)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Fecha tentativa"
              type="date"
              value={tentativeDate}
              onChange={(e) => setTentativeDate(e.target.value)}
              required
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Duración estimada (opcional)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  inputMode="numeric"
                  className={selectClass}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="3"
                />
                <span className="shrink-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                  días
                </span>
              </div>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Descripción del trabajo
            </span>
            <textarea
              className="min-h-[80px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 py-2.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qué se hará en el lugar…"
            />
          </label>

          <div className="rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page)] px-3 py-2.5">
            <p className="m-0 text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Prevención siempre recibe el aviso
            </p>
            <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
              Llega a su bandeja y a su correo: ella valida la documentación de
              la contratista antes de habilitar el trabajo.
            </p>
          </div>

          <p className="m-0 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-brand-sky)_12%,white)] px-3 py-2 text-[12px] text-[var(--color-nachipa-body)]">
            El área se toma de tu usuario. Si la empresa aún no está habilitada,
            Prevención pedirá la documentación.
          </p>
        </form>
      </Modal>

      {accessToken && canCreatePermit && isStaff ? (
        <WorkPermitCreateModal
          open={Boolean(permitFromNotice)}
          accessToken={accessToken}
          initialNotice={permitFromNotice}
          onClose={() => setPermitFromNotice(null)}
          onCreated={(permitId) => {
            void load();
            navigate(`/prevencion/permisos/${permitId}`);
          }}
        />
      ) : null}

      <Modal
        open={Boolean(deleteRow)}
        onClose={() => {
          if (!deleting) setDeleteRow(null);
        }}
        title="Eliminar aviso"
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
          Se quita de la bandeja
          {deleteRow?.workPermit
            ? ` y también el permiso ${deleteRow.workPermit.code}`
            : ""}
          . Esta acción no se puede deshacer desde la UI.
        </p>
      </Modal>
    </div>
  );
}
