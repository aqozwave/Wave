import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Download, MoreVertical } from "lucide-react";
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
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  listBusinessesRequest,
  type Business,
} from "../../lib/api/businesses";
import {
  createDocumentTypeRequest,
  deleteDocumentTypeRequest,
  listDocumentTypesRequest,
  updateDocumentTypeRequest,
  type DocumentActorScope,
  type DocumentAppliesTo,
  type DocumentSubtype,
  type DocumentType,
  type DocumentTypeWriteBody,
} from "../../lib/api/documentTypes";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { downloadXls } from "../../lib/exportXls";

/** API que el header usa para abrir el modal de alta. */
export type DocumentTypesPanelHandle = {
  openCreate: () => void;
};

/** Opciones de subtipo (Figma D40/D41). */
const SUBTYPE_OPTIONS: ReadonlyArray<{
  value: DocumentSubtype;
  label: string;
}> = [
  { value: "general", label: "General" },
  { value: "finiquito", label: "Finiquito" },
  { value: "requerimiento", label: "Requerimiento" },
  { value: "prevencion", label: "Prevención" },
  { value: "maritimo", label: "Marítimo" },
  { value: "activo", label: "Activos" },
];

/** Figma «Aplica a». */
const APPLIES_TO_OPTIONS: ReadonlyArray<{
  value: DocumentAppliesTo;
  label: string;
}> = [
  { value: "crew", label: "Tripulante" },
  { value: "external", label: "Persona externa" },
  { value: "crew_and_external", label: "Tripulante · Persona externa" },
];

/** Figma «Lo suben» / «Lo ven». */
const ACTOR_SCOPE_OPTIONS: ReadonlyArray<{
  value: DocumentActorScope;
  label: string;
}> = [
  {
    value: "prevention_or_admin",
    label: "Prevencionista o Administrador",
  },
  {
    value: "prevention_admin_hr_assets",
    label: "Prevencionista o Administrador · RR.HH. · Activos",
  },
  { value: "admin", label: "Administrador" },
  { value: "hr", label: "RR.HH." },
  { value: "assets", label: "Activos" },
];

/** Form create / edit alineado a D41. */
type FormState = {
  code: string;
  name: string;
  subtype: DocumentSubtype;
  appliesTo: DocumentAppliesTo;
  requiresExpiry: boolean;
  uploadBy: DocumentActorScope;
  viewBy: DocumentActorScope;
  crewCanView: boolean;
  businessId: string;
  state: boolean;
};

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  subtype: "prevencion",
  appliesTo: "crew_and_external",
  requiresExpiry: true,
  uploadBy: "prevention_or_admin",
  viewBy: "prevention_or_admin",
  crewCanView: true,
  businessId: "",
  state: true,
};

/** Capitaliza nombre en minúsculas (API guarda lower). */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Etiqueta de subtipo. */
function subtypeLabel(value: string): string {
  return SUBTYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Etiqueta de aplica a. */
function appliesToLabel(value: string): string {
  return APPLIES_TO_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Fila opción con fondo gris (Figma Opción + Toggle). */
function OptionToggleRow({
  title,
  description,
  checked,
  onChange,
  "aria-label": ariaLabel,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  "aria-label": string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-[var(--color-table-head-bg,#f8f9fb)] px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
          {title}
        </p>
        <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
          {description}
        </p>
      </div>
      <Toggle checked={checked} onChange={onChange} aria-label={ariaLabel} />
    </div>
  );
}

/**
 * Panel Tipos de documento dentro de Catálogos maestros.
 * Códigos HR por empresa (CO, EN, WL…).
 */
export const DocumentTypesPanel = forwardRef<DocumentTypesPanelHandle>(
  function DocumentTypesPanel(_props, ref) {
    const { accessToken, user } = useAuth();
    const { showToast } = useToast();
    const isSuperadmin = user?.internalRol === "superadmin";
    const canManage =
      user?.internalRol === "admin" || user?.internalRol === "superadmin";

    const [items, setItems] = useState<DocumentType[]>([]);
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<DocumentType | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [menuId, setMenuId] = useState<string | null>(null);

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
        const [typesResult, bizResult] = await Promise.all([
          listDocumentTypesRequest(accessToken, 1, 200),
          isSuperadmin
            ? listBusinessesRequest(accessToken)
            : Promise.resolve({ items: [] as Business[] }),
        ]);
        setItems(typesResult.items);
        setBusinesses(bizResult.items);
      } catch (err) {
        showToast(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los tipos de documento.",
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
      if (!q) return items;
      return items.filter((row) => {
        const biz = businessNameById.get(row.businessId) ?? "";
        return [row.code, row.name, row.subtype, biz]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
    }, [items, search, businessNameById]);

    // Paginación cliente sobre la lista filtrada
    const { page, setPage, pageSize, setPageSize, pageCount, pageItems, total } =
      useClientTablePagination(filtered);

    function openCreate() {
      setEditing(null);
      setForm(EMPTY_FORM);
      setModalOpen(true);
    }

    useImperativeHandle(ref, () => ({ openCreate }), []);

    function openEdit(row: DocumentType) {
      setEditing(row);
      setMenuId(null);
      setForm({
        code: row.code,
        name: row.name,
        subtype: (row.subtype as DocumentSubtype) || "general",
        appliesTo: (row.appliesTo as DocumentAppliesTo) || "crew_and_external",
        requiresExpiry: row.requiresExpiry,
        uploadBy: (row.uploadBy as DocumentActorScope) || "prevention_or_admin",
        viewBy: (row.viewBy as DocumentActorScope) || "prevention_or_admin",
        crewCanView: row.crewCanView,
        businessId: row.businessId,
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

    async function onSubmit(event: FormEvent) {
      event.preventDefault();
      if (!accessToken || !canManage) return;
      if (!form.code.trim()) {
        showToast("El código es requerido.", "danger");
        return;
      }
      if (!form.name.trim()) {
        showToast("El nombre es requerido.", "danger");
        return;
      }
      if (!editing && isSuperadmin && !form.businessId) {
        showToast("Elegí la empresa.", "danger");
        return;
      }

      setSubmitting(true);
      try {
        const body: DocumentTypeWriteBody = {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          subtype: form.subtype,
          appliesTo: form.appliesTo,
          requiresExpiry: form.requiresExpiry,
          uploadBy: form.uploadBy,
          viewBy: form.viewBy,
          crewCanView: form.crewCanView,
          state: form.state,
        };
        if (isSuperadmin && form.businessId) {
          body.businessId = form.businessId;
        }

        if (editing) {
          // Código inmutable tras el alta (Figma).
          const { code: _code, ...patch } = body;
          await updateDocumentTypeRequest(accessToken, editing.id, patch);
          showToast("Tipo de documento actualizado.", "success");
        } else {
          await createDocumentTypeRequest(accessToken, body);
          showToast("Tipo de documento creado.", "success");
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

    async function onDelete(row: DocumentType) {
      if (!accessToken || !canManage) return;
      setMenuId(null);
      const ok = window.confirm(
        `¿Eliminar el tipo «${row.code} — ${displayName(row.name)}»? Quedará desactivado.`,
      );
      if (!ok) return;
      try {
        await deleteDocumentTypeRequest(accessToken, row.id);
        showToast("Tipo de documento eliminado.", "success");
        await load();
      } catch (err) {
        showToast(
          err instanceof ApiError ? err.message : "No se pudo eliminar.",
          "danger",
        );
      }
    }

    /** Descarga CSV de los tipos de documento filtrados (no solo la página actual). */
    function onExport() {
      if (filtered.length === 0) {
        showToast("No hay filas para exportar.", "info");
        return;
      }
      downloadXls(
        filtered,
        [
          { header: "Código", value: (row) => row.code },
          { header: "Nombre", value: (row) => displayName(row.name) },
          // Columna empresa: solo disponible y relevante para superadmin.
          ...(isSuperadmin
            ? [
                {
                  header: "Empresa",
                  value: (row: DocumentType) =>
                    businessNameById.get(row.businessId) ?? "",
                },
              ]
            : []),
          { header: "Subtipo", value: (row) => subtypeLabel(row.subtype) },
          {
            header: "Aplica a",
            value: (row) => appliesToLabel(row.appliesTo),
          },
          {
            header: "Vence",
            value: (row) => (row.requiresExpiry ? "Sí" : "No"),
          },
          { header: "Estado", value: (row) => (row.state ? "Activo" : "Inactivo") },
        ],
        "tipos-documento",
      );
      showToast("Excel descargado.", "success");
    }

    const selectClass =
      "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

    /** Columnas del empty state (varía con superadmin). */
    const colCount = isSuperadmin ? 8 : 7;

    return (
      <>
        {/* DataTableCard: toolbar con búsqueda y exportar, tabla, pie con paginación */}
        <DataTableCard
          toolbar={
            <>
              {/* Búsqueda por código, nombre o empresa */}
              <DataTableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar por código o nombre…"
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
                  : `${total} ${total === 1 ? "tipo" : "tipos"}`
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
          <table className="w-full min-w-[780px] table-fixed border-collapse text-left text-[12px]">
            <colgroup>
              <col style={{ width: "9%" }} />
              <col style={{ width: isSuperadmin ? "18%" : "24%" }} />
              {isSuperadmin ? <col style={{ width: "14%" }} /> : null}
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr>
                {/* Primera columna: esquina izquierda redondeada */}
                <TableHeaderCell rounded="left">Código</TableHeaderCell>
                <TableHeaderCell>Nombre</TableHeaderCell>
                {isSuperadmin ? (
                  <TableHeaderCell>Empresa</TableHeaderCell>
                ) : null}
                <TableHeaderCell>Subtipo</TableHeaderCell>
                <TableHeaderCell>Aplica a</TableHeaderCell>
                <TableHeaderCell>Vence</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                {/* Última columna: esquina derecha redondeada, acciones a la derecha */}
                <TableHeaderCell rounded="right" align="right">
                  Acciones
                </TableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {!loading && total === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                  >
                    No hay tipos de documento para mostrar.
                  </td>
                </tr>
              ) : null}
              {pageItems.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--color-tremor-border)] last:border-b-0"
                >
                  <td className="h-[52px] px-3 font-medium tabular-nums text-[var(--color-nachipa-title)]">
                    {row.code}
                  </td>
                  <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                    {displayName(row.name)}
                  </td>
                  {isSuperadmin ? (
                    <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {businessNameById.get(row.businessId) ?? "—"}
                    </td>
                  ) : null}
                  <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                    {subtypeLabel(row.subtype)}
                  </td>
                  <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                    {appliesToLabel(row.appliesTo)}
                  </td>
                  <td className="h-[52px] px-3 text-[var(--color-nachipa-body)]">
                    {row.requiresExpiry ? "Sí" : "No"}
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

        <Modal
          open={modalOpen}
          title={
            editing ? "Editar tipo de documento" : "Nuevo tipo de documento"
          }
          subtitle="Catálogos maestros · Tipos de documento"
          onClose={closeModal}
          maxWidthClass="w-full max-w-[560px] sm:w-[560px]"
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
                form="document-type-form"
                className="!w-auto !h-9"
                disabled={submitting}
              >
                {submitting
                  ? "Guardando…"
                  : editing
                    ? "Guardar cambios"
                    : "Crear tipo"}
              </Button>
            </div>
          }
        >
          <form
            id="document-type-form"
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
            noValidate
          >
            {isSuperadmin ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Empresa *
                </span>
                <select
                  className={selectClass}
                  value={form.businessId}
                  onChange={(e) => setField("businessId", e.target.value)}
                  required
                  disabled={Boolean(editing)}
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

            <div className="flex flex-col gap-1.5">
              <TextField
                label="Código *"
                name="code"
                value={form.code}
                onChange={(e) =>
                  setField("code", e.target.value.toUpperCase().slice(0, 4))
                }
                required
                maxLength={4}
                placeholder="Ej. CO, EN, WL"
                disabled={Boolean(editing)}
              />
              <p className="text-[12px] leading-4 text-[var(--color-nachipa-secondary)]">
                Código corto y único (2 a 4 letras). No se puede cambiar después.
              </p>
            </div>

            <TextField
              label="Nombre *"
              name="name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              required
              placeholder="Ej. Contrato, Entrega de EPP"
            />

            <div className="flex gap-4">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Subtipo *
                </span>
                <select
                  className={selectClass}
                  value={form.subtype}
                  onChange={(e) =>
                    setField("subtype", e.target.value as DocumentSubtype)
                  }
                  required
                >
                  {SUBTYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Aplica a *
                </span>
                <select
                  className={selectClass}
                  value={form.appliesTo}
                  onChange={(e) =>
                    setField("appliesTo", e.target.value as DocumentAppliesTo)
                  }
                  required
                >
                  {APPLIES_TO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <OptionToggleRow
              title="Vence"
              description="Pide fecha de vencimiento al cargar el documento"
              checked={form.requiresExpiry}
              onChange={(next) => setField("requiresExpiry", next)}
              aria-label="Requiere fecha de vencimiento"
            />

            <div className="rounded-lg bg-[var(--color-status-info-bg)] px-3 py-2.5">
              <p className="text-[12px] text-[var(--color-status-info-fg)]">
                Visibilidad · quién lo sube y quién lo ve
              </p>
            </div>

            <div className="flex gap-4">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Lo suben
                </span>
                <select
                  className={selectClass}
                  value={form.uploadBy}
                  onChange={(e) =>
                    setField("uploadBy", e.target.value as DocumentActorScope)
                  }
                >
                  {ACTOR_SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Lo ven
                </span>
                <select
                  className={selectClass}
                  value={form.viewBy}
                  onChange={(e) =>
                    setField("viewBy", e.target.value as DocumentActorScope)
                  }
                >
                  {ACTOR_SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <OptionToggleRow
              title="El tripulante puede ver este documento"
              description="Si lo apagas, solo lo ven los roles indicados arriba"
              checked={form.crewCanView}
              onChange={(next) => setField("crewCanView", next)}
              aria-label="El tripulante puede ver este documento"
            />

            <OptionToggleRow
              title="Activo"
              description="Disponible para nuevas cargas al expediente"
              checked={form.state}
              onChange={(next) => setField("state", next)}
              aria-label="Tipo de documento activo"
            />
          </form>
        </Modal>
      </>
    );
  },
);
