import { Section, Text } from "@react-email/components";
import { EmailLayout } from "./EmailLayout.js";

/** Fila del resumen admin de capacitaciones. */
export type TrainingAdminDigestRow = {
  crewName: string;
  crewRun: string;
  trainingName: string;
  expiresLabel: string;
  estado: string;
};

/** Props del digest diario de capacitaciones. */
export type TrainingAdminDigestProps = {
  rows: TrainingAdminDigestRow[];
};

/**
 * Resumen para admin / prevencionista: capacitaciones por vencer y vencidas.
 */
export function TrainingAdminDigest({ rows }: TrainingAdminDigestProps) {
  const countLabel = `${rows.length} registro${rows.length === 1 ? "" : "s"}`;
  return (
    <EmailLayout title="Capacitaciones — vigencias">
      <Text style={styles.paragraph}>
        Resumen de capacitaciones que requieren atención ({countLabel}):
      </Text>
      <Section style={styles.tableWrap}>
        {rows.map((row, index) => (
          <Text
            key={`${row.crewRun}-${row.trainingName}-${index}`}
            style={styles.row}
          >
            <strong>{row.crewName}</strong> · {row.crewRun || "—"} ·{" "}
            {row.trainingName} · {row.expiresLabel} · {row.estado}
          </Text>
        ))}
      </Section>
      <Text style={styles.muted}>
        Generado automáticamente por el Portal Nachipa Wellboats.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  paragraph: {
    margin: "0 0 14px",
    color: "#334155",
    fontSize: "15px",
    lineHeight: "1.65",
  },
  tableWrap: {
    margin: "12px 0 20px",
    padding: "12px 14px",
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
  },
  row: {
    margin: "0 0 8px",
    color: "#0f172a",
    fontSize: "13px",
    lineHeight: "1.45",
  },
  muted: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "1.55",
  },
};
