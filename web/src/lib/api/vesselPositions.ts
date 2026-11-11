import { ApiError, type ApiErrorBody } from "./auth";

/** Última posición conocida de una nave (null = sin lecturas). */
export type VesselPosition = {
  locationId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  source: string;
  recordedAt: string;
  reportedById: string | null;
} | null;

/** Fila del listado flota (coords null = sin señal). */
export type VesselPositionListItem = {
  locationId: string;
  locationName: string;
  kind: "vessel" | "office" | "warehouse" | "other" | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  source: string | null;
  recordedAt: string | null;
  reportedById: string | null;
};

/** Body para reportar lat/lng desde el navegador. */
export type ReportVesselPositionBody = {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
};

/** Parsea error estándar Wave. */
function toApiError(res: Response, body: unknown): ApiError {
  const err = body as ApiErrorBody | null;
  return new ApiError(
    res.status,
    err?.code ?? "request_failed",
    err?.message ?? `HTTP ${res.status}`,
  );
}

/** Headers Bearer para rutas protegidas. */
function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** GET /locations/me/position — última posición de la nave del usuario. */
export async function getMyVesselPositionRequest(
  accessToken: string,
): Promise<VesselPosition> {
  const res = await fetch("/api/v1/locations/me/position", {
    headers: authHeaders(accessToken),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as VesselPosition;
}

/** GET /locations/:id/position — última posición de una ubicación. */
export async function getLocationVesselPositionRequest(
  accessToken: string,
  locationId: string,
): Promise<VesselPosition> {
  const res = await fetch(`/api/v1/locations/${locationId}/position`, {
    headers: authHeaders(accessToken),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as VesselPosition;
}

/** POST /locations/me/position — guarda lat/lng del navegador. */
export async function reportMyVesselPositionRequest(
  accessToken: string,
  payload: ReportVesselPositionBody,
): Promise<NonNullable<VesselPosition>> {
  const res = await fetch("/api/v1/locations/me/position", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as NonNullable<VesselPosition>;
}

/** GET /locations/positions — última señal por nave (admin / flota). */
export async function listVesselPositionsRequest(
  accessToken: string,
  query?: { businessId?: string },
): Promise<{ items: VesselPositionListItem[] }> {
  const params = new URLSearchParams();
  if (query?.businessId) {
    params.set("businessId", query.businessId);
  }
  const qs = params.toString();
  const res = await fetch(
    `/api/v1/locations/positions${qs ? `?${qs}` : ""}`,
    { headers: authHeaders(accessToken) },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as { items: VesselPositionListItem[] };
}
