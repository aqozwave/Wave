import {
  WORK_PERMIT_PROGRESS_STEPS,
  workPermitProgress,
  type WorkPermitStatus,
} from "../../lib/api/workPermits";

type Props = {
  /** Estado actual del PT. */
  status: WorkPermitStatus;
};

/**
 * Celda densa de avance (Figma P6): mini timeline de 6 hitos + %.
 * Completados = navy lleno; actual = anillo; próximos = gris; sin cierre = — danger.
 */
export function WorkPermitProgressCell({ status }: Props) {
  const progress = workPermitProgress(status);
  const title = progress.terminalDanger
    ? "Sin cierre"
    : progress.percent === null
      ? "Avance"
      : `${progress.percent}% del ciclo`;

  return (
    <div
      className="inline-flex items-center gap-2"
      title={title}
      aria-label={title}
    >
      <span className="inline-flex items-center" aria-hidden>
        {WORK_PERMIT_PROGRESS_STEPS.map((step, index) => {
          const isDone =
            progress.allComplete ||
            (!progress.terminalDanger && index < progress.stepIndex);
          const isCurrent =
            !progress.allComplete && index === progress.stepIndex;
          const connectorDone =
            progress.allComplete ||
            (!progress.terminalDanger && index < progress.stepIndex);

          return (
            <span key={step.key} className="inline-flex items-center">
              {index > 0 ? (
                <span
                  className={[
                    "mx-0.5 h-[2px] w-2.5 rounded-full",
                    connectorDone
                      ? "bg-[var(--color-nachipa-primary)]"
                      : "bg-[var(--color-tremor-border,#e4e4e7)]",
                  ].join(" ")}
                />
              ) : null}
              <span
                className={[
                  "box-border inline-block size-2 rounded-full",
                  isDone
                    ? "bg-[var(--color-nachipa-primary)]"
                    : isCurrent && progress.terminalDanger
                      ? "border-2 border-[var(--color-status-danger-fg,#b91c1c)] bg-white"
                      : isCurrent
                        ? "border-2 border-[var(--color-nachipa-primary)] bg-white"
                        : "bg-[var(--color-tremor-border,#e4e4e7)]",
                ].join(" ")}
              />
            </span>
          );
        })}
      </span>
      <span
        className={[
          "min-w-[2.25rem] text-right text-[12px] font-semibold tabular-nums",
          progress.terminalDanger
            ? "text-[var(--color-status-danger-fg,#b91c1c)]"
            : "text-[var(--color-nachipa-primary)]",
        ].join(" ")}
      >
        {progress.percent === null ? "—" : `${progress.percent}%`}
      </span>
    </div>
  );
}
