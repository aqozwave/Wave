import { useEffect, useState } from "react";

/** Estado de la pastilla de salud de la API. */
type HealthState =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

/** Respuesta mínima de GET /api/v1/health. */
type HealthResponse = {
  status: "ok";
};

/** Consulta el endpoint de salud; lanza si no es 200 o el body no es ok. */
async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/v1/health");

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const body: unknown = await res.json();

  if (
    typeof body !== "object" ||
    body === null ||
    !("status" in body) ||
    body.status !== "ok"
  ) {
    throw new Error("Respuesta inválida");
  }

  return body as HealthResponse;
}

/**
 * Chip de estado de la API (fundaciones Sección 0).
 * Hace poll cada 15s; útil en Topbar de pantallas que aún lo monten.
 */
export function HealthStatus() {
  const [state, setState] = useState<HealthState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    /** Una lectura de /health; ignora resultado si el efecto ya se limpió. */
    async function load() {
      try {
        await fetchHealth();
        if (!cancelled) {
          setState({ kind: "ok" });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "Error de red",
          });
        }
      }
    }

    void load();
    // 15s: bastante para ver caídas sin martillar la API en local.
    const id = window.setInterval(() => {
      void load();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <StatusChip
        label="API…"
        tone="pending"
        title="Consultando salud de la API"
      />
    );
  }

  if (state.kind === "ok") {
    return (
      <StatusChip label="API ok" tone="ok" title="GET /api/v1/health → 200" />
    );
  }

  return (
    <StatusChip label="API error" tone="error" title={state.message} />
  );
}

/** Pastilla compacta con punto de color (ok / error / pending). */
function StatusChip({
  label,
  tone,
  title,
}: {
  label: string;
  tone: "ok" | "error" | "pending";
  title: string;
}) {
  const color =
    tone === "ok"
      ? "var(--color-status-ok)"
      : tone === "error"
        ? "var(--color-status-error)"
        : "var(--color-status-pending)";

  return (
    <span
      title={title}
      className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] px-2.5 text-[12px] font-medium text-[var(--color-nachipa-body)]"
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
