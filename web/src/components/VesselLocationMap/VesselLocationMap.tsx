import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import { MapPin, RefreshCw } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { ApiError } from "../../lib/auth/AuthContext";
import {
  getLocationVesselPositionRequest,
  getMyVesselPositionRequest,
  listVesselPositionsRequest,
  reportMyVesselPositionRequest,
  type VesselPosition,
  type VesselPositionListItem,
} from "../../lib/api/vesselPositions";

/** Cada cuánto el PC a bordo relee el GPS del navegador (5 minutos). */
const REPORT_INTERVAL_MS = 5 * 60 * 1000;

/** Cada cuánto el Panel vuelve a pedir la última posición guardada. */
const POLL_INTERVAL_MS = 60 * 1000;

/** Zoom por defecto del mini mapa (una sola nave). */
const DEFAULT_ZOOM = 11;

/** Centro de respaldo (Puerto Montt) si la flota no tiene señales. */
const FALLBACK_CENTER: [number, number] = [-41.4693, -72.9424];

/** Zoom de respaldo cuando no hay puntos en el mapa flota. */
const FALLBACK_ZOOM = 7;

/** Color navy Nachipa para marcadores en línea. */
const MARKER_COLOR_ONLINE = "#004c8c";

/** Ámbar para señal retrasada (última lectura entre 15 min y 2 h). */
const MARKER_COLOR_DELAYED = "#b54708";

/** Gris para última posición muy antigua (&gt; 2 h); sigue en el mapa como referencia. */
const MARKER_COLOR_OFFLINE = "#71717a";

/** Umbral “en línea”: última señal más reciente que esto (15 minutos). */
const ONLINE_WITHIN_MS = 15 * 60 * 1000;

/** Umbral “retrasado”: entre online y esto (2 horas); más viejo = sin señal. */
const DELAYED_WITHIN_MS = 2 * 60 * 60 * 1000;

/** Estado de frescura de la señal GPS de una nave. */
type SignalStatus = "online" | "delayed" | "offline";

/**
 * Clasifica la última lectura por antigüedad.
 * online &lt; 15 min · delayed &lt; 2 h · offline = sin lectura o más vieja.
 */
function signalStatus(recordedAt: string | null | undefined): SignalStatus {
  if (!recordedAt) {
    return "offline";
  }
  const ageMs = Date.now() - new Date(recordedAt).getTime();
  if (ageMs < 0 || Number.isNaN(ageMs)) {
    return "offline";
  }
  if (ageMs <= ONLINE_WITHIN_MS) {
    return "online";
  }
  if (ageMs <= DELAYED_WITHIN_MS) {
    return "delayed";
  }
  return "offline";
}

/** Etiqueta visible del chip de estado. */
function signalStatusLabel(status: SignalStatus): string {
  if (status === "online") return "En línea";
  if (status === "delayed") return "Retrasado";
  return "Sin señal";
}

/** Clases Tailwind del chip según frescura. */
function signalStatusChipClass(status: SignalStatus): string {
  if (status === "online") {
    return "bg-[var(--color-status-success-bg,#ecfdf3)] text-[var(--color-status-success-fg,#027a48)]";
  }
  if (status === "delayed") {
    return "bg-[var(--color-status-warning-bg,#fffaeb)] text-[var(--color-status-warning-fg,#b54708)]";
  }
  return "bg-[var(--color-status-neutral-bg,#f4f4f5)] text-[var(--color-status-neutral-fg,#52525b)]";
}

/** Color del punto en el mapa según frescura. */
function signalMarkerColor(status: SignalStatus): string {
  if (status === "online") return MARKER_COLOR_ONLINE;
  if (status === "delayed") return MARKER_COLOR_DELAYED;
  return MARKER_COLOR_OFFLINE;
}

/**
 * Tarjeta del Panel: mapa Leaflet.
 * - single: una nave (+ reporte GPS si canReport).
 * - fleet: todas las naves del tenant + tabla de última señal (admin).
 */
export function VesselLocationMap({
  accessToken,
  mode,
  locationId,
  locationName,
  canReport,
  businessId,
}: {
  accessToken: string;
  /** single = una nave; fleet = mapa + tabla de toda la flota. */
  mode: "single" | "fleet";
  /** Nave a mostrar en modo single; null = vacío. */
  locationId: string | null;
  /** Nombre visible en modo single. */
  locationName: string | null;
  /** true solo si el usuario puede reportar GPS de esa nave. */
  canReport: boolean;
  /** Filtro opcional de empresa (superadmin). */
  businessId?: string | null;
}) {
  if (mode === "fleet") {
    return (
      <FleetVesselLocationMap
        accessToken={accessToken}
        businessId={businessId}
      />
    );
  }

  return (
    <SingleVesselLocationMap
      accessToken={accessToken}
      locationId={locationId}
      locationName={locationName}
      canReport={canReport}
    />
  );
}

/** Vista de una sola nave (capitán o filtro del admin). */
function SingleVesselLocationMap({
  accessToken,
  locationId,
  locationName,
  canReport,
}: {
  accessToken: string;
  locationId: string | null;
  locationName: string | null;
  canReport: boolean;
}) {
  const [position, setPosition] = useState<VesselPosition>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [loading, setLoading] = useState(false);

  /** Carga la última posición desde la API. */
  const loadPosition = useCallback(async () => {
    if (!locationId) {
      setPosition(null);
      return;
    }
    setLoading(true);
    try {
      const data = canReport
        ? await getMyVesselPositionRequest(accessToken)
        : await getLocationVesselPositionRequest(accessToken, locationId);
      setPosition(data);
      setStatus(null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo cargar la posición";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, canReport, locationId]);

  /** Lee el GPS del navegador y lo envía a la API. */
  const reportBrowserPosition = useCallback(async () => {
    if (!canReport || !accessToken) {
      return;
    }
    if (!navigator.geolocation) {
      setStatus("Este navegador no soporta geolocalización");
      return;
    }
    setReporting(true);
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (coords) => {
          void (async () => {
            try {
              const saved = await reportMyVesselPositionRequest(accessToken, {
                latitude: coords.coords.latitude,
                longitude: coords.coords.longitude,
                accuracyM: coords.coords.accuracy,
              });
              setPosition(saved);
              setStatus(null);
            } catch (err) {
              const message =
                err instanceof ApiError
                  ? err.message
                  : "No se pudo guardar la posición";
              setStatus(message);
            } finally {
              setReporting(false);
              resolve();
            }
          })();
        },
        (geoErr) => {
          setReporting(false);
          setStatus(geoErr.message || "No se pudo obtener la ubicación");
          resolve();
        },
        {
          enableHighAccuracy: true,
          timeout: 20_000,
          maximumAge: 60_000,
        },
      );
    });
  }, [accessToken, canReport]);

  useEffect(() => {
    void loadPosition();
    const pollId = window.setInterval(() => {
      void loadPosition();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(pollId);
  }, [loadPosition]);

  useEffect(() => {
    if (!canReport) {
      return;
    }
    void reportBrowserPosition();
    const reportId = window.setInterval(() => {
      void reportBrowserPosition();
    }, REPORT_INTERVAL_MS);
    return () => window.clearInterval(reportId);
  }, [canReport, reportBrowserPosition]);

  const titleName = locationName?.trim() || position?.locationName || "Nave";

  return (
    <MapCardShell
      title="Ubicación de la nave"
      subtitle={
        locationId
          ? `${titleName}${position?.recordedAt ? ` · ${formatRelative(position.recordedAt)}` : ""}`
          : "Sin nave asignada"
      }
      action={
        canReport ? (
          <ReportButton
            reporting={reporting}
            onClick={() => {
              void reportBrowserPosition();
            }}
          />
        ) : null
      }
      status={status}
    >
      {!locationId ? (
        <EmptyMapState message="Asigná una nave al usuario o filtrá una embarcación." />
      ) : loading && !position ? (
        <EmptyMapState message="Cargando posición…" />
      ) : !position ? (
        <EmptyMapState
          message={
            canReport
              ? "Sin posición aún. Permití la ubicación del navegador."
              : "Sin lecturas guardadas para esta nave."
          }
        />
      ) : (
        <MiniMap
          mapKey={`${position.latitude.toFixed(5)}-${position.longitude.toFixed(5)}`}
          center={[position.latitude, position.longitude]}
          zoom={DEFAULT_ZOOM}
          markers={[
            {
              id: position.locationId,
              name: position.locationName,
              lat: position.latitude,
              lng: position.longitude,
            },
          ]}
        />
      )}
    </MapCardShell>
  );
}

/** Vista flota: mapa con varias naves + tabla de última señal. */
function FleetVesselLocationMap({
  accessToken,
  businessId,
}: {
  accessToken: string;
  businessId?: string | null;
}) {
  const [items, setItems] = useState<VesselPositionListItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Carga la última señal de todas las naves visibles. */
  const loadFleet = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listVesselPositionsRequest(accessToken, {
        businessId: businessId ?? undefined,
      });
      setItems(data.items);
      setStatus(null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo cargar la flota";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, businessId]);

  useEffect(() => {
    void loadFleet();
    const pollId = window.setInterval(() => {
      void loadFleet();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(pollId);
  }, [loadFleet]);

  const withCoords = useMemo(
    () =>
      items.filter(
        (row) => row.latitude != null && row.longitude != null,
      ) as Array<
        VesselPositionListItem & { latitude: number; longitude: number }
      >,
    [items],
  );

  const onlineCount = useMemo(
    () => items.filter((row) => signalStatus(row.recordedAt) === "online").length,
    [items],
  );
  const delayedCount = useMemo(
    () =>
      items.filter((row) => signalStatus(row.recordedAt) === "delayed").length,
    [items],
  );
  const totalCount = items.length;

  return (
    <MapCardShell
      title="Ubicación de la nave"
      subtitle={
        loading && items.length === 0
          ? "Cargando flota…"
          : `${onlineCount} en línea · ${delayedCount} retrasadas · ${totalCount} naves`
      }
      action={
        <button
          type="button"
          onClick={() => {
            void loadFleet();
          }}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold leading-[19px] text-[var(--color-nachipa-primary)] disabled:opacity-60"
          title="Actualizar flota"
        >
          <RefreshCw
            size={14}
            strokeWidth={1.5}
            className={loading ? "animate-spin" : undefined}
            aria-hidden
          />
          Actualizar
        </button>
      }
      status={status}
    >
      {loading && items.length === 0 ? (
        <EmptyMapState message="Cargando posiciones…" />
      ) : withCoords.length === 0 ? (
        <EmptyMapState message="Ninguna nave ha reportado posición aún." />
      ) : (
        <MiniMap
          mapKey={withCoords
            .map((r) => `${r.locationId}:${r.recordedAt}`)
            .join("|")}
          center={
            withCoords.length === 1
              ? [withCoords[0].latitude, withCoords[0].longitude]
              : FALLBACK_CENTER
          }
          zoom={withCoords.length === 1 ? DEFAULT_ZOOM : FALLBACK_ZOOM}
          markers={withCoords.map((row) => ({
            id: row.locationId,
            name: row.locationName,
            lat: row.latitude,
            lng: row.longitude,
            recordedAt: row.recordedAt,
            status: signalStatus(row.recordedAt),
          }))}
          fitToMarkers={withCoords.length > 1}
        />
      )}

      {items.length > 0 ? (
        <div className="mt-2 max-h-[120px] shrink-0 overflow-auto rounded-[10px] border border-[var(--color-nachipa-border-subtle)]">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-[var(--color-table-head-bg,#f8f9fb)] text-[11px] font-medium text-[var(--color-table-head-text)]">
              <tr>
                <th className="px-2.5 py-1.5 font-medium">Nave</th>
                <th className="px-2.5 py-1.5 font-medium">Última señal</th>
                <th className="px-2.5 py-1.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const status = signalStatus(row.recordedAt);
                return (
                  <tr
                    key={row.locationId}
                    className="border-t border-[var(--color-nachipa-border-subtle)]"
                  >
                    <td className="truncate px-2.5 py-1.5 font-medium capitalize text-[var(--color-nachipa-title)]">
                      {row.locationName}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 tabular-nums text-[var(--color-nachipa-body)]">
                      {row.recordedAt ? formatRelative(row.recordedAt) : "—"}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          signalStatusChipClass(status),
                        ].join(" ")}
                      >
                        {signalStatusLabel(status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </MapCardShell>
  );
}

/** Contenedor visual común de la tarjeta. */
function MapCardShell({
  title,
  subtitle,
  action,
  status,
  children,
}: {
  title: string;
  subtitle: string;
  action: ReactNode;
  status: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <MapPin
          size={18}
          strokeWidth={1.5}
          className="shrink-0 text-[var(--color-nachipa-primary)]"
          aria-hidden
        />
        <h2 className="min-w-0 flex-1 text-[16px] font-semibold leading-[22px] text-[var(--color-nachipa-title)]">
          {title}
        </h2>
        {action}
      </div>
      <p className="mb-2 shrink-0 truncate text-[12px] text-[var(--color-nachipa-secondary)]">
        {subtitle}
      </p>
      {children}
      {status ? (
        <p className="mt-2 shrink-0 text-[11px] text-[var(--color-status-danger-fg,#b42318)]">
          {status}
        </p>
      ) : null}
    </div>
  );
}

/** Botón “Actualizar” del GPS a bordo. */
function ReportButton({
  reporting,
  onClick,
}: {
  reporting: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={reporting}
      className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold leading-[19px] text-[var(--color-nachipa-primary)] disabled:opacity-60"
      title="Leer GPS ahora"
    >
      <RefreshCw
        size={14}
        strokeWidth={1.5}
        className={reporting ? "animate-spin" : undefined}
        aria-hidden
      />
      Actualizar
    </button>
  );
}

/** Placeholder cuando no hay mapa. */
function EmptyMapState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-[10px] border border-dashed border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg,#f8f9fb)] px-4 text-center">
      <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
        {message}
      </p>
    </div>
  );
}

/** Mapa Leaflet con uno o varios marcadores. */
function MiniMap({
  mapKey,
  center,
  zoom,
  markers,
  fitToMarkers = false,
}: {
  mapKey: string;
  center: [number, number];
  zoom: number;
  markers: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    recordedAt?: string | null;
    status?: SignalStatus;
  }>;
  fitToMarkers?: boolean;
}) {
  return (
    <div className="min-h-[220px] flex-1 overflow-hidden rounded-[10px] border border-[var(--color-nachipa-border-subtle)]">
      <MapContainer
        key={mapKey}
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        dragging={markers.length > 1}
        zoomControl={markers.length > 1}
        doubleClickZoom={false}
        attributionControl
        style={{ width: "100%", height: "100%", minHeight: 220 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {fitToMarkers ? (
          <FitBounds points={markers.map((m) => [m.lat, m.lng])} />
        ) : null}
        {markers.map((m) => {
          const status = m.status ?? signalStatus(m.recordedAt);
          const color = signalMarkerColor(status);
          return (
            <CircleMarker
              key={m.id}
              center={[m.lat, m.lng]}
              radius={8}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: status === "offline" ? 0.45 : 0.85,
                weight: 2,
              }}
            >
              <Popup>
                <span className="capitalize">{m.name}</span>
                <br />
                {signalStatusLabel(status)}
                <br />
                {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                {m.recordedAt ? (
                  <>
                    <br />
                    {formatRelative(m.recordedAt)}
                  </>
                ) : null}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

/** Ajusta el viewport para envolver todos los puntos de la flota. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) {
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], DEFAULT_ZOOM);
      return;
    }
    map.fitBounds(points, { padding: [28, 28], maxZoom: 12 });
  }, [map, points]);
  return null;
}

/** Texto corto “hace N min” / hora local. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
