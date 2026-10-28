import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ClipboardList,
  Pencil,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { Link, useParams } from "react-router";

import { Button } from "../../components/Button/Button";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { listAreasRequest, type Area } from "../../lib/api/areas";
import {
  listCompetencyCertificatesRequest,
  type CompetencyCertificate,
} from "../../lib/api/competencyCertificates";
import {
  getCrewMemberRequest,
  type CrewMember,
} from "../../lib/api/crewMembers";
import { listLocationsRequest, type Location } from "../../lib/api/locations";
import {
  formatBoardingBookDate,
  getBoardingBookUiState,
} from "../../lib/boardingBook";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Tabs de la ficha (Figma D3). */
type FichaTab =
  | "cursos"
  | "capacitaciones"
  | "libreta"
  | "datos"
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
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [crew, setCrew] = useState<CrewMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FichaTab>("cursos");
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [certs, setCerts] = useState<CompetencyCertificate[]>([]);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    try {
      const [row, locs, areaList, certList] = await Promise.all([
        getCrewMemberRequest(accessToken, id),
        listLocationsRequest(accessToken),
        listAreasRequest(accessToken),
        listCompetencyCertificatesRequest(accessToken),
      ]);
      setCrew(row);
      setLocations(locs.items);
      setAreas(areaList.items);
      setCerts(certList.items);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cargar la ficha.",
        "danger",
      );
      setCrew(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, showToast]);

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

  const tabs: { id: FichaTab; label: string }[] = [
    { id: "cursos", label: "Cursos (0)" },
    { id: "capacitaciones", label: "Capacitaciones" },
    { id: "libreta", label: "Libreta de embarque" },
    { id: "datos", label: "Datos personales" },
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
                    onClick={() => setTab("datos")}
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
                <p className="mt-4 text-[12px] text-[var(--color-nachipa-secondary)]">
                  La edición inline / modal “Actualizar embarcado” (Figma D34)
                  la conectamos en el siguiente paso.
                </p>
              </div>
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
