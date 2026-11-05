import { useCallback, useEffect, useState } from "react";
import { Building2, ClipboardCheck, FileStack, Users } from "lucide-react";
import { Button } from "../../components/Button/Button";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  getContractorPortalSummaryRequest,
  type ContractorPortalSummary,
} from "../../lib/api/contractors";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Capitaliza nombre guardado en minúsculas. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Etiqueta estado HAB. */
function habStatusLabel(status: string): string {
  switch (status) {
    case "invited":
      return "Invitada";
    case "pending":
      return "Pendiente";
    case "in_review":
      return "En revisión";
    case "observed":
      return "Observada";
    case "approved":
      return "Habilitada";
    case "rejected":
      return "Rechazada";
    default:
      return status;
  }
}

/** Tono chip HAB. */
function habStatusTone(
  status: string,
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "approved":
      return "success";
    case "in_review":
      return "info";
    case "observed":
    case "pending":
    case "invited":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

/** Fecha corta es-CL. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL");
  } catch {
    return "—";
  }
}

/**
 * Panel del contratista (P2 · E3 / E3b).
 * Usuario con organizationId: resumen HAB + pasos de documentación.
 */
export function ContratistaHome() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<ContractorPortalSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const row = await getContractorPortalSummaryRequest(accessToken);
      setSummary(row);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar el panel",
        "danger",
      );
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = displayName(user?.firstName ?? "");
  const orgName = summary
    ? displayName(summary.organization.name)
    : user?.organization
      ? displayName(user.organization.name)
      : "tu empresa";

  const hab = summary?.accreditation ?? null;
  const docsUploaded = summary?.companyDocuments.uploaded ?? 0;
  const docsRequired = summary?.companyDocuments.required ?? 0;
  const peopleTotal = summary?.people.total ?? 0;

  const greeting =
    hab?.status === "pending" || hab?.status === "observed"
      ? `Bienvenida, ${firstName}`
      : `Hola, ${firstName}`;

  const subtitle = !hab
    ? `${orgName} · aún no hay una habilitación abierta.`
    : hab.status === "approved"
      ? `${orgName} · Habilitada desde ${formatDate(hab.reviewedAt)} · ${peopleTotal} personas`
      : hab.status === "pending" || hab.status === "observed"
        ? `${orgName} · Prevención te pidió la documentación para habilitar a tu empresa.`
        : `${orgName} · HAB ${hab.code} · ${habStatusLabel(hab.status)}`;

  const ctaLabel =
    hab?.status === "approved"
      ? "Ver mi habilitación"
      : "Completar antecedentes";

  /** Pasos de la bandeja E3b. */
  const steps = [
    {
      id: "antecedentes",
      title: "Completar los antecedentes generales",
      detail: "Contactos, mutualidad, supervisor y prevencionista.",
      appliesTo: "Empresa",
      statusLabel: "Pendiente",
      tone: "warning" as const,
      blocked: false,
    },
    {
      id: "docs",
      title: `Subir los ${docsRequired || "…"} documentos de la empresa`,
      detail:
        docsRequired > 0
          ? `${docsUploaded} de ${docsRequired} cargados`
          : "Configurá el pack empresa en Prevención.",
      appliesTo: "Empresa",
      statusLabel:
        docsRequired > 0 && docsUploaded >= docsRequired
          ? "Listo"
          : "Pendiente",
      tone:
        docsRequired > 0 && docsUploaded >= docsRequired
          ? ("success" as const)
          : ("warning" as const),
      blocked: false,
    },
    {
      id: "people",
      title: "Agregar a tu personal y subir sus documentos",
      detail:
        peopleTotal === 0
          ? "Sin personal."
          : `${peopleTotal} persona(s) cargada(s)`,
      appliesTo: "Personas",
      statusLabel: peopleTotal > 0 ? "En curso" : "Pendiente",
      tone: peopleTotal > 0 ? ("info" as const) : ("warning" as const),
      blocked: false,
    },
    {
      id: "submit",
      title: "Enviar a revisión",
      detail: "Prevención valida y te informa el resultado.",
      appliesTo: "Empresa",
      statusLabel:
        hab?.status === "in_review"
          ? "Enviada"
          : hab?.status === "approved"
            ? "Aprobada"
            : "Bloqueado",
      tone:
        hab?.status === "in_review" || hab?.status === "approved"
          ? ("success" as const)
          : ("neutral" as const),
      blocked:
        hab?.status !== "in_review" &&
        hab?.status !== "approved" &&
        hab?.status !== "observed",
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Panel"
        breadcrumbIcon={Building2}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader
          crumbs={[{ label: "Mi empresa" }, { label: "Panel" }]}
          title={greeting}
          description={subtitle}
          actions={
            <Button type="button" size="medium" className="!w-auto" disabled>
              + {ctaLabel}
            </Button>
          }
        />

        {loading ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando panel…
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={ClipboardCheck}
                label="Habilitación"
                value={hab ? habStatusLabel(hab.status) : "Sin HAB"}
                hint={
                  hab
                    ? hab.status === "approved"
                      ? `desde ${formatDate(hab.reviewedAt)}`
                      : hab.status === "pending"
                        ? "sin enviar"
                        : hab.code
                    : "Esperá la solicitud de Prevención"
                }
                chip={
                  hab ? (
                    <StatusChip tone={habStatusTone(hab.status)}>
                      {habStatusLabel(hab.status)}
                    </StatusChip>
                  ) : null
                }
              />
              <KpiCard
                icon={FileStack}
                label="Documentos de la empresa"
                value={`${docsUploaded} / ${docsRequired || "—"}`}
                hint={
                  docsUploaded === 0
                    ? "ninguno cargado"
                    : `${docsUploaded} cargado(s)`
                }
              />
              <KpiCard
                icon={Users}
                label="Personal"
                value={String(peopleTotal)}
                hint={
                  peopleTotal === 0
                    ? "agrega a tus trabajadores"
                    : "personas activas"
                }
              />
              <KpiCard
                icon={Building2}
                label="Organización"
                value={summary?.organization.rut ?? "—"}
                hint={summary?.organization.specialty ?? "contratista"}
              />
            </div>

            <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-4">
              <h2 className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                {hab?.status === "approved" ? "Estado" : "Pendientes"}
              </h2>
              <ul className="m-0 list-none divide-y divide-[var(--color-tremor-border)] p-0">
                {steps.map((step, idx) => (
                  <li
                    key={step.id}
                    className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-nachipa-bg-page)] text-[12px] font-semibold text-[var(--color-nachipa-title)]">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[13px] font-medium text-[var(--color-nachipa-title)]">
                        {step.title}
                      </p>
                      <p className="m-0 mt-0.5 text-[12px] text-[var(--color-nachipa-secondary)]">
                        {step.detail}
                      </p>
                    </div>
                    <span className="text-[12px] text-[var(--color-nachipa-body)]">
                      {step.appliesTo}
                    </span>
                    <StatusChip tone={step.blocked ? "neutral" : step.tone}>
                      {step.statusLabel}
                    </StatusChip>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/** Tarjeta KPI del panel contratista. */
function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  chip,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  hint: string;
  chip?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
          <Icon size={16} strokeWidth={1.5} aria-hidden />
          {label}
        </span>
        {chip}
      </div>
      <p className="m-0 text-[20px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
        {value}
      </p>
      <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
        {hint}
      </p>
    </div>
  );
}
