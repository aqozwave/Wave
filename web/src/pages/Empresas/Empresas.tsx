import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  Download,
  MoreVertical,
  Plus,
  Upload,
} from "lucide-react";
import { Button } from "../../components/Button/Button";
import { ConfirmModal } from "../../components/ConfirmModal/ConfirmModal";
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
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import {
  createBusinessRequest,
  deleteBusinessRequest,
  listBusinessesRequest,
  listBusinessModulesRequest,
  patchBusinessModuleRequest,
  updateBusinessRequest,
  type Business,
  type BusinessModule,
  type BusinessModuleKey,
  type BusinessWriteBody,
} from "../../lib/api/businesses";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { downloadXls } from "../../lib/exportXls";
import { isRutValid, normalizeRut } from "../../lib/rut";

/** Etiquetas S6 de submódulos Prevención. */
const MODULE_LABELS: Record<
  BusinessModuleKey,
  { title: string; hint: string }
> = {
  contractors: {
    title: "Contratistas",
    hint: "Empresas externas, habilitación y documentos",
  },
  work_permits: {
    title: "Permisos de trabajo",
    hint: "Avisos, tipos y PT (requiere Contratistas)",
  },
  trainings: {
    title: "Capacitaciones",
    hint: "Capacitaciones del módulo Prevención",
  },
};

/** Form create (Figma 1 paso) + edit extendido. */
type FormState = {
  name: string;
  rut: string;
  giro: string;
  country: string;
  commune: string;
  city: string;
  phone: string;
  email: string;
  description: string;
  state: boolean;
  /** Solo UI create (aún no hay endpoint de invitación). */
  adminEmail: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  rut: "",
  giro: "",
  country: "Chile",
  commune: "",
  city: "",
  phone: "",
  email: "",
  description: "",
  state: true,
  adminEmail: "",
};

/** Capitaliza nombre guardado en minúsculas. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Inicial del preview de logo (Figma). */
function initialOf(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : "A";
}

/**
 * Pantalla Empresas (Figma S5 · 184:12144).
 * Lista + modal Nueva empresa (1 paso); editar con campos extendidos.
 */
export function Empresas() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";

  const [items, setItems] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  /** Interruptores Prevención (solo al editar como superadmin). */
  const [modules, setModules] = useState<BusinessModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [moduleSavingKey, setModuleSavingKey] = useState<BusinessModuleKey | null>(
    null,
  );
  /** Menú kebab abierto por fila. */
  const [menuId, setMenuId] = useState<string | null>(null);
  /** Empresa pendiente de confirmar eliminación (modal del sistema). */
  const [pendingDelete, setPendingDelete] = useState<Business | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await listBusinessesRequest(accessToken);
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las empresas.",
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
    if (!q) return items;
    return items.filter((b) =>
      [b.rut, b.name, b.giro, b.city, b.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  /* Paginación cliente: resetea automáticamente cuando cambia filtered. */
  const { page, setPage, pageSize, setPageSize, pageCount, pageItems, total } =
    useClientTablePagination(filtered);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModules([]);
    setModalOpen(true);
  }

  function openEdit(row: Business) {
    setEditing(row);
    setMenuId(null);
    setForm({
      name: row.name,
      rut: row.rut ?? "",
      giro: row.giro ?? "",
      country: row.country ?? "Chile",
      commune: row.commune ?? "",
      city: row.city ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      description: row.description ?? "",
      state: row.state,
      adminEmail: "",
    });
    setModules([]);
    setModalOpen(true);
    if (isSuperadmin && accessToken) {
      setModulesLoading(true);
      void listBusinessModulesRequest(accessToken, row.id)
        .then((result) => setModules(result.items))
        .catch((err) => {
          showToast(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar los módulos.",
            "danger",
          );
        })
        .finally(() => setModulesLoading(false));
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setModules([]);
    setModuleSavingKey(null);
  }

  /** S6: prende/apaga un submódulo Prevención (inmediato, fuera del form). */
  async function onToggleModule(key: BusinessModuleKey, enabled: boolean) {
    if (!accessToken || !editing) return;
    setModuleSavingKey(key);
    try {
      const result = await patchBusinessModuleRequest(
        accessToken,
        editing.id,
        key,
        enabled,
      );
      setModules((prev) => {
        const next = prev.map((row) =>
          row.key === result.item.key ? result.item : row,
        );
        /** R-02: contractors off también apaga work_permits en UI. */
        if (result.cascadedOff.length > 0) {
          return next.map((row) =>
            result.cascadedOff.includes(row.key)
              ? {
                  ...row,
                  enabled: false,
                  enabledAt: null,
                  enabledById: null,
                }
              : row,
          );
        }
        return next;
      });
      const cascade =
        result.cascadedOff.length > 0
          ? ` También se apagó: ${result.cascadedOff.join(", ")}.`
          : "";
      showToast(
        enabled
          ? `Módulo ${MODULE_LABELS[key].title} activado.`
          : `Módulo ${MODULE_LABELS[key].title} desactivado.${cascade}`,
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cambiar el módulo.",
        "danger",
      );
    } finally {
      setModuleSavingKey(null);
    }
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildBody(): BusinessWriteBody {
    if (editing && !isSuperadmin) {
      return {
        giro: form.giro || undefined,
        country: form.country || undefined,
        commune: form.commune || undefined,
        city: form.city || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        description: form.description || undefined,
      };
    }
    return {
      rut: form.rut.trim() ? normalizeRut(form.rut) : undefined,
      name: form.name.trim(),
      giro: form.giro || undefined,
      country: form.country || undefined,
      commune: form.commune || undefined,
      city: form.city || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      description: form.description || undefined,
      state: form.state,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    if (!form.name.trim()) {
      showToast("El nombre es requerido.", "danger");
      return;
    }
    // Superadmin puede enviar RUT; si lo escribe, debe pasar el dígito verificador.
    if (
      (isSuperadmin || !editing) &&
      form.rut.trim() &&
      !isRutValid(form.rut)
    ) {
      showToast("El RUT no es válido.", "danger");
      return;
    }
    if (form.adminEmail.trim()) {
      // UI Figma: invitación aún no cableada al API.
      showToast(
        "La invitación al administrador se habilitará en un próximo paso.",
        "info",
      );
    }

    setSubmitting(true);
    try {
      const body = buildBody();
      if (editing) {
        await updateBusinessRequest(accessToken, editing.id, body);
        showToast("Empresa actualizada.", "success");
      } else {
        await createBusinessRequest(accessToken, body);
        showToast("Empresa creada.", "success");
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

  /** Abre modal de confirmación de eliminación. */
  function requestDelete(row: Business) {
    if (!isSuperadmin) return;
    setMenuId(null);
    setPendingDelete(row);
  }

  /** Soft-delete confirmado. */
  async function confirmDelete() {
    if (!accessToken || !isSuperadmin || !pendingDelete) return;
    setDeleting(true);
    try {
      await deleteBusinessRequest(accessToken, pendingDelete.id);
      showToast("Empresa eliminada.", "success");
      setPendingDelete(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar.",
        "danger",
      );
    } finally {
      setDeleting(false);
    }
  }

  /** Descarga CSV de las empresas filtradas (no solo la página actual). */
  function onExport() {
    if (filtered.length === 0) {
      showToast("No hay filas para exportar.", "info");
      return;
    }
    downloadXls(
      filtered,
      [
        { header: "RUT", value: (row) => row.rut ?? "" },
        { header: "Nombre", value: (row) => displayName(row.name) },
        { header: "Giro", value: (row) => row.giro ?? "" },
        { header: "Ciudad", value: (row) => row.city ?? "" },
        { header: "Estado", value: (row) => (row.state ? "Activo" : "Inactivo") },
      ],
      "empresas",
    );
    showToast("Excel descargado.", "success");
  }

  const lockKeyFields = Boolean(editing) && !isSuperadmin;
  const previewName = form.name.trim()
    ? displayName(form.name)
    : "Nueva empresa";

  // Un solo fondo #f9fafc (Figma): Topbar + content, sin franja blanca.
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f9fafc]">
      <Topbar
        breadcrumb="Empresas"
        breadcrumbIcon={Building2}
        actions={<UserMenu />}
      />

      {/* Content (Figma 184:12148): pl-32 pr-48, sin scroll horizontal. */}
      <div className="animate-enter flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden pb-6 pl-8 pr-12 pt-7">
        <PageHeader
          crumbs={[
            { label: "Configuración" },
            { label: "Empresas" },
          ]}
          title="Empresas"
          description={
            isSuperadmin
              ? "Administra todas las empresas del sistema."
              : "Administra la información de tu empresa."
          }
          actions={
            isSuperadmin ? (
              <Button type="button" className="!w-auto shrink-0" onClick={openCreate}>
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                Nueva empresa
              </Button>
            ) : undefined
          }
        />

        {/* Tarjeta DataTable Figma: toolbar con search + exportar, pie con paginación. */}
        <DataTableCard
          toolbar={
            <>
              <DataTableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar empresa…"
              />
              <DataTableOutlineButton onClick={onExport}>
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
                  : `${total} ${total === 1 ? "empresa" : "empresas"}`
              }
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-[12px]">
            <colgroup>
              <col style={{ width: "16%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr>
                <TableHeaderCell rounded="left">RUT</TableHeaderCell>
                <TableHeaderCell>Nombre</TableHeaderCell>
                <TableHeaderCell>Giro</TableHeaderCell>
                <TableHeaderCell>Ciudad</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                {/* Acciones: redondeada a la derecha (Figma DataTable). */}
                <TableHeaderCell rounded="right" align="right">
                  Acciones
                </TableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {!loading && total === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                  >
                    No hay empresas para mostrar.
                  </td>
                </tr>
              ) : null}
              {pageItems.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--color-tremor-border)] last:border-b-0 hover:bg-[var(--color-nachipa-bg-page)]"
                >
                  <td className="h-[52px] truncate px-3 tabular-nums text-[var(--color-nachipa-body)]">
                    {row.rut || "—"}
                  </td>
                  <td className="h-[52px] truncate px-3 font-medium text-[var(--color-nachipa-title)]">
                    {displayName(row.name)}
                  </td>
                  <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                    {row.giro || "—"}
                  </td>
                  <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                    {row.city || "—"}
                  </td>
                  <td className="h-[52px] px-3">
                    {/* StatusChip Figma: success = activo, danger = inactivo. */}
                    <StatusChip tone={row.state ? "success" : "danger"}>
                      {row.state ? "Activo" : "Inactivo"}
                    </StatusChip>
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
                          onClick={() => openEdit(row)}
                        >
                          Editar
                        </button>
                        {isSuperadmin ? (
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-status-danger-fg)] hover:bg-[var(--color-status-danger-bg)]"
                            onClick={() => requestDelete(row)}
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableCard>
      </div>

      <Modal
        open={modalOpen}
        icon={Building2}
        title={editing ? "Editar empresa" : "Nueva empresa"}
        subtitle={
          editing
            ? "Actualizá los datos de la empresa. El nombre es obligatorio."
            : "Solo el nombre es obligatorio. Lo demás lo completas después en Configuración."
        }
        onClose={closeModal}
        /* Crear = 520 Figma; editar = 720 + grilla 2 cols (menos alto, sin scroll feo). */
        maxWidthClass={
          editing
            ? "w-full max-w-[720px] sm:w-[720px]"
            : "w-full max-w-[520px] sm:w-[520px]"
        }
        footer={
          <div className="flex flex-col gap-3">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                form="empresa-form"
                onClick={closeModal}
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab,#f4f4f5)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
              >
                Cancelar
              </button>
              <Button
                type="submit"
                form="empresa-form"
                className="!w-auto"
                disabled={submitting}
              >
                {submitting
                  ? "Guardando…"
                  : editing
                    ? "Guardar cambios"
                    : "Crear empresa"}
              </Button>
            </div>
            <p className="text-center text-[12px] text-[var(--color-nachipa-secondary)]">
              {editing
                ? "Los cambios se aplican de inmediato en el portal."
                : "Después podrás agregar naves, usuarios y cursos desde Configuración."}
            </p>
          </div>
        }
      >
        <form
          id="empresa-form"
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex items-center gap-3 rounded-xl bg-[var(--color-table-head-bg,#f8f9fb)] px-3.5 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-nachipa-primary)] text-[16px] font-bold text-white">
              {initialOf(form.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-[var(--color-nachipa-title)]">
                {previewName}
              </span>
              <span className="block text-[12px] text-[var(--color-nachipa-secondary)]">
                Así se verá en el selector de empresas
              </span>
            </span>
          </div>

          <div
            className={
              editing
                ? "grid gap-4 sm:grid-cols-2"
                : "flex flex-col gap-4"
            }
          >
            <TextField
              label="Nombre de la empresa *"
              name="name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              required
              disabled={lockKeyFields}
              placeholder="Austral Wellboats"
            />
            <TextField
              label="RUT"
              name="rut"
              value={form.rut}
              onChange={(e) => setField("rut", e.target.value)}
              disabled={lockKeyFields}
              placeholder="Opcional · ej. 76.123.456-7"
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[13px]">
              <span className="font-medium text-[var(--color-nachipa-title)]">
                Logo
              </span>{" "}
              <span className="text-[var(--color-nachipa-secondary)]">
                opcional
              </span>
            </p>
            <div className="flex items-center gap-3 rounded-[10px] border border-[var(--color-tremor-border)] px-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-nachipa-primary)] text-[16px] font-bold text-white">
                {initialOf(form.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Usando la primera letra
                </span>
                <span className="block text-[12px] text-[var(--color-nachipa-secondary)]">
                  SVG o PNG cuadrado, hasta 2 MB
                </span>
              </span>
              <button
                type="button"
                className="inline-flex h-[30px] items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[12px] font-medium text-[var(--color-nachipa-body)]"
                onClick={() =>
                  showToast(
                    "La subida de logo llega en un próximo paso.",
                    "info",
                  )
                }
              >
                <Upload className="size-3.5" strokeWidth={1.5} aria-hidden />
                Subir
              </button>
            </div>
          </div>

          {editing ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Giro"
                  name="giro"
                  value={form.giro}
                  onChange={(e) => setField("giro", e.target.value)}
                  placeholder="Opcional"
                />
                <TextField
                  label="Ciudad"
                  name="city"
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="Opcional"
                />
                <TextField
                  label="País"
                  name="country"
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                />
                <TextField
                  label="Teléfono"
                  name="phone"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <TextField
                label="Correo"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="contacto@empresa.com"
              />
              {isSuperadmin ? (
                <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                      Empresa activa
                    </p>
                    <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                      Visible y operable en el portal
                    </p>
                  </div>
                  <Toggle
                    checked={form.state}
                    onChange={(next) => setField("state", next)}
                    aria-label="Empresa activa"
                  />
                </div>
              ) : null}
              {isSuperadmin ? (
                <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                      Módulos Prevención
                    </p>
                    <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                      Se guardan al instante. Sin módulo activo no aparecen en
                      Roles ni en el menú del tenant.
                    </p>
                  </div>
                  {modulesLoading ? (
                    <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                      Cargando módulos…
                    </p>
                  ) : (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                      {modules.map((mod) => {
                        const meta = MODULE_LABELS[mod.key];
                        return (
                          <li
                            key={mod.key}
                            className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-nachipa-bg-page)] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="m-0 text-[13px] font-medium text-[var(--color-nachipa-title)]">
                                {meta.title}
                              </p>
                              <p className="m-0 text-[11px] text-[var(--color-nachipa-secondary)]">
                                {meta.hint}
                              </p>
                            </div>
                            <Toggle
                              checked={mod.enabled}
                              disabled={moduleSavingKey === mod.key}
                              onChange={(next) =>
                                void onToggleModule(mod.key, next)
                              }
                              aria-label={meta.title}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div>
              <TextField
                label="Administrador inicial"
                name="adminEmail"
                type="email"
                value={form.adminEmail}
                onChange={(e) => setField("adminEmail", e.target.value)}
                placeholder="Correo · opcional"
              />
              <p className="mt-1.5 text-[12px] leading-4 text-[var(--color-nachipa-secondary)]">
                Le enviamos una invitación para que configure su empresa
              </p>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Eliminar empresa"
        message={
          pendingDelete
            ? `¿Eliminar la empresa «${displayName(pendingDelete.name)}»?`
            : "¿Eliminar esta empresa?"
        }
        detail="Quedará desactivada."
        confirmLabel="Eliminar"
        busyLabel="Eliminando…"
        busy={deleting}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </div>
  );
}
