import { TriangleAlert } from "lucide-react";

import type { Muelle } from "../../lib/api/muelles";
import type { Travesia } from "../../lib/api/travesias";

/** Capitaliza para etiquetas del panel. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Agrupa muelles por nombre de puerto (como Figma D34). */
function groupMuellesByPort(muelles: Muelle[]): Map<string, Muelle[]> {
  const map = new Map<string, Muelle[]>();
  for (const m of muelles) {
    const key = m.portName || "Sin puerto";
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return map;
}

/** Agrupa travesías por cuota de pasadas (10 / 4 / otras). */
function groupTravesiasByPassages(
  travesias: Travesia[],
): { label: string; items: Travesia[] }[] {
  const ten = travesias.filter((t) => t.requiredPassages === 10);
  const four = travesias.filter((t) => t.requiredPassages === 4);
  const other = travesias.filter(
    (t) => t.requiredPassages !== 10 && t.requiredPassages !== 4,
  );
  const groups: { label: string; items: Travesia[] }[] = [];
  if (ten.length > 0) {
    groups.push({ label: "Rutas de 10 travesías", items: ten });
  }
  if (four.length > 0) {
    groups.push({ label: "Rutas de 4 travesías", items: four });
  }
  if (other.length > 0) {
    groups.push({ label: "Otras rutas", items: other });
  }
  return groups;
}

type OfficerAssignmentsPanelProps = {
  muelles: Muelle[];
  travesias: Travesia[];
  selectedMuelleIds: Set<string>;
  selectedTravesiaIds: Set<string>;
  onToggleMuelle: (id: string) => void;
  onToggleTravesia: (id: string) => void;
};

/**
 * Sección Figma D34: checklists de muelles (por puerto) y travesías (por cuota).
 * Visible solo cuando el título marítimo tiene requiresMuelleTravesia.
 */
export function OfficerAssignmentsPanel({
  muelles,
  travesias,
  selectedMuelleIds,
  selectedTravesiaIds,
  onToggleMuelle,
  onToggleTravesia,
}: OfficerAssignmentsPanelProps) {
  const byPort = groupMuellesByPort(muelles);
  const travesiaGroups = groupTravesiasByPassages(travesias);
  const muelleCount = selectedMuelleIds.size;
  const travesiaCount = selectedTravesiaIds.size;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page)] p-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-nachipa-title)]">
        Muelles y travesías · obligatorio
      </h3>

      <div className="flex gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-status-danger-border,#fecaca)] bg-[var(--color-status-danger-bg)] px-3 py-2.5">
        <TriangleAlert
          className="mt-0.5 size-4 shrink-0 text-[var(--color-status-danger-fg)]"
          strokeWidth={1.5}
          aria-hidden
        />
        <p className="text-[12px] leading-[18px] text-[var(--color-status-danger-fg)]">
          Obligatorio: al menos 1 muelle y 1 travesía. Podés agregar más
          después.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
              Muelles
            </span>
            <span className="inline-flex rounded-full bg-[var(--color-status-info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-status-info-fg)]">
              {muelleCount} de {muelles.length}
            </span>
          </div>
          {muelles.length === 0 ? (
            <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
              No hay muelles en el catálogo de esta empresa.
            </p>
          ) : (
            <div className="flex max-h-[280px] flex-col gap-3 overflow-y-auto">
              {[...byPort.entries()].map(([port, list]) => (
                <div key={port}>
                  <p className="mb-1.5 text-[12px] font-medium text-[var(--color-nachipa-title)]">
                    {displayName(port)}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {list.map((m) => {
                      const checked = selectedMuelleIds.has(m.id);
                      return (
                        <li key={m.id}>
                          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--color-nachipa-body)]">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-[var(--color-tremor-border)]"
                              checked={checked}
                              onChange={() => onToggleMuelle(m.id)}
                            />
                            {displayName(m.name)}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
              Travesías
            </span>
            <span
              className={[
                "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                travesiaCount === 0
                  ? "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]"
                  : "bg-[var(--color-status-info-bg)] text-[var(--color-status-info-fg)]",
              ].join(" ")}
            >
              {travesiaCount} de {travesias.length}
            </span>
          </div>
          {travesias.length === 0 ? (
            <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
              No hay travesías en el catálogo de esta empresa.
            </p>
          ) : (
            <div className="flex max-h-[280px] flex-col gap-3 overflow-y-auto">
              {travesiaGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-[12px] font-medium text-[var(--color-nachipa-title)]">
                    {group.label}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {group.items.map((t) => {
                      const checked = selectedTravesiaIds.has(t.id);
                      return (
                        <li key={t.id}>
                          <label className="flex cursor-pointer items-start gap-2 text-[13px] text-[var(--color-nachipa-body)]">
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 shrink-0 rounded border-[var(--color-tremor-border)]"
                              checked={checked}
                              onChange={() => onToggleTravesia(t.id)}
                            />
                            <span>{displayName(t.name)}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-[var(--color-nachipa-secondary)]">
        Esta sección aparece si el título marítimo tiene activo “Exige muelles y
        travesías” en Catálogos maestros.
      </p>
    </section>
  );
}
