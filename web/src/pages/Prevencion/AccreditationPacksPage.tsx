import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { HardHat, Plus, X } from "lucide-react";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  listBusinessesRequest,
  type Business,
} from "../../lib/api/businesses";
import {
  listDocumentTypesRequest,
  updateDocumentTypeRequest,
  type DocumentAccreditationPack,
  type DocumentType,
} from "../../lib/api/documentTypes";
import { userHasPermission } from "../../lib/api/auth";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Botón outline secundario (Cancelar / Agregar compacto). */
const outlineBtnClass =
  "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/** Clase de selects. */
const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

/** Capitaliza nombre guardado en minúsculas. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Meta de cada pack (empresa / persona). */
const PACK_META: Record<
  DocumentAccreditationPack,
  { title: string; legend: string }
> = {
  company: {
    title: "Pack empresa",
    legend:
      "Documentos que se exigen al habilitar una organización externa. Una exigencia tipo «pack» de alcance empresa usa esta lista.",
  },
  person: {
    title: "Pack persona",
    legend:
      "Documentos que se exigen al habilitar un trabajador. Una exigencia tipo «pack» de alcance persona usa esta lista.",
  },
};

/**
 * Maestro editable del pack de habilitación (P1).
 * Membresía = document_types.accreditationPack (company | person | null).
 * No hay lista hardcodeada: se edita acá o en Catálogos → Tipos de documento.
 */
export function AccreditationPacksPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";
  const canRead = userHasPermission(user, "maestros.document_types", "read");
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";

  const [businesses, setBusinesses] = useState<Business[]>([]);
  /** Empresa filtro (superadmin); vacío = tenant del usuario vía API. */
  const [businessId, setBusinessId] = useState("");
  const [allDocs, setAllDocs] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<DocumentAccreditationPack | null>(
    null,
  );
  const [addDocId, setAddDocId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /** Fila a sacar del pack (Modal, no alert). */
  const [pendingRemove, setPendingRemove] = useState<DocumentType | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setLoading(true);
    try {
      const result = await listDocumentTypesRequest(accessToken, 1, 200, {
        businessId: businessId || undefined,
      });
      setAllDocs(result.items.filter((d) => d.state && !d.deletedAt));
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar tipos de documento",
        "danger",
      );
      setAllDocs([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, businessId, canRead, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!accessToken || !isSuperadmin) return;
    void listBusinessesRequest(accessToken, 1, 100)
      .then((r) => setBusinesses(r.items))
      .catch(() => setBusinesses([]));
  }, [accessToken, isSuperadmin]);

  const companyPack = useMemo(
    () =>
      allDocs
        .filter((d) => d.accreditationPack === "company")
        .sort((a, b) => a.code.localeCompare(b.code)),
    [allDocs],
  );

  const personPack = useMemo(
    () =>
      allDocs
        .filter((d) => d.accreditationPack === "person")
        .sort((a, b) => a.code.localeCompare(b.code)),
    [allDocs],
  );

  /** Candidatos a agregar: activos fuera del pack destino (pueden venir de otro pack). */
  const addCandidates = useMemo(() => {
    if (!addTarget) return [];
    return allDocs
      .filter((d) => d.accreditationPack !== addTarget)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [allDocs, addTarget]);

  /** Abre modal para sumar un tipo al pack. */
  function openAdd(pack: DocumentAccreditationPack) {
    setAddTarget(pack);
    setAddDocId("");
    setAddOpen(true);
  }

  /** Asigna el tipo al pack destino (pisa membership anterior). */
  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !addTarget || !addDocId) return;
    setSubmitting(true);
    try {
      await updateDocumentTypeRequest(accessToken, addDocId, {
        accreditationPack: addTarget,
      });
      showToast("Documento agregado al pack", "success");
      setAddOpen(false);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo agregar",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** Saca el tipo del pack (accreditationPack = null). */
  async function confirmRemove() {
    if (!accessToken || !pendingRemove) return;
    setRemoving(true);
    try {
      await updateDocumentTypeRequest(accessToken, pendingRemove.id, {
        accreditationPack: null,
      });
      showToast("Documento sacado del pack", "success");
      setPendingRemove(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo quitar",
        "danger",
      );
    } finally {
      setRemoving(false);
    }
  }

  /** Lista de un pack (empresa o persona). */
  function PackColumn({
    pack,
    items,
  }: {
    pack: DocumentAccreditationPack;
    items: DocumentType[];
  }) {
    const meta = PACK_META[pack];
    return (
      <section className="flex min-h-0 flex-1 flex-col rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-tremor-border)] px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
              {meta.title}
            </h2>
            <p className="m-0 mt-1 text-[12px] text-[var(--color-nachipa-secondary)]">
              {meta.legend}
            </p>
            <p className="m-0 mt-2 text-[12px] font-medium text-[var(--color-nachipa-title)]">
              {items.length} documento(s)
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              className={outlineBtnClass}
              onClick={() => openAdd(pack)}
            >
              <Plus size={16} strokeWidth={1.5} aria-hidden />
              Agregar
            </button>
          ) : null}
        </header>
        <ul className="m-0 flex list-none flex-col gap-0 p-0">
          {loading ? (
            <li className="px-4 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
              Cargando…
            </li>
          ) : items.length === 0 ? (
            <li className="px-4 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
              Pack vacío. Agregá tipos de documento del catálogo.
            </li>
          ) : (
            items.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 border-b border-[var(--color-tremor-border)] px-4 py-3 last:border-b-0"
              >
                <span className="w-10 shrink-0 text-[13px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                  {doc.code}
                </span>
                <span className="min-w-0 flex-1 text-[13px] text-[var(--color-nachipa-body)]">
                  {displayName(doc.name)}
                </span>
                <StatusChip tone={doc.requiresExpiry ? "warning" : "neutral"}>
                  {doc.requiresExpiry ? "Con vencimiento" : "Sin venc."}
                </StatusChip>
                {canManage ? (
                  <button
                    type="button"
                    className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nachipa-secondary)] hover:bg-[var(--color-nachipa-bg-page)] hover:text-[var(--color-nachipa-title)]"
                    aria-label={`Sacar ${doc.code} del pack`}
                    onClick={() => setPendingRemove(doc)}
                  >
                    <X size={16} strokeWidth={1.5} aria-hidden />
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    );
  }

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Prevención"
          breadcrumbIcon={HardHat}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            No tenés permiso para ver tipos de documento
            (maestros.document_types).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Prevención"
        breadcrumbIcon={HardHat}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Packs de habilitación" },
          ]}
          title="Packs de habilitación"
          description="Definí qué documentos del catálogo forman el pack empresa y el pack persona. Las exigencias tipo «pack» de un permiso usan estas listas."
        />

        {isSuperadmin ? (
          <label className="flex max-w-sm flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Empresa
            </span>
            <select
              className={selectClass}
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
            >
              <option value="">Todas / por defecto</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {displayName(b.name)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PackColumn pack="company" items={companyPack} />
          <PackColumn pack="person" items={personPack} />
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => {
          if (!submitting) setAddOpen(false);
        }}
        title={
          addTarget
            ? `Agregar a ${PACK_META[addTarget].title}`
            : "Agregar al pack"
        }
        subtitle="Si el documento ya está en el otro pack, se mueve a este."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setAddOpen(false)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="pack-add-form"
              size="medium"
              className="!w-auto"
              disabled={submitting || !addDocId}
            >
              {submitting ? "Guardando…" : "Agregar"}
            </Button>
          </div>
        }
      >
        <form
          id="pack-add-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => void handleAdd(e)}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Tipo de documento
            </span>
            <select
              className={selectClass}
              value={addDocId}
              onChange={(e) => setAddDocId(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {addCandidates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} · {displayName(d.name)}
                  {d.accreditationPack
                    ? ` (hoy: pack ${d.accreditationPack === "company" ? "empresa" : "persona"})`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(pendingRemove)}
        onClose={() => {
          if (!removing) setPendingRemove(null);
        }}
        title="Sacar del pack"
        subtitle={
          pendingRemove
            ? `${pendingRemove.code} · ${displayName(pendingRemove.name)} dejará de exigirse en las habilitaciones de este alcance. El tipo de documento sigue en el catálogo.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={removing}
              onClick={() => setPendingRemove(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={removing}
              onClick={() => void confirmRemove()}
            >
              {removing ? "Quitando…" : "Sacar del pack"}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[13px] text-[var(--color-nachipa-body)]">
          Confirmá para quitarlo solo del pack (no borra el tipo).
        </p>
      </Modal>
    </div>
  );
}
