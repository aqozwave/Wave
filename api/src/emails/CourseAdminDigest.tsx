import { Section, Text } from "@react-email/components";
import { EmailLayout } from "./EmailLayout.js";

/** Fila del resumen admin. */
export type CourseAdminDigestRow = {
  crewName: string;
  crewRun: string;
  courseName: string;
  expiresLabel: string;
  estado: string;
};

/** Props del digest diario de cursos. */
export type CourseAdminDigestProps = {
  rows: CourseAdminDigestRow[];
};

/**
 * Resumen para admin/superadmin: cursos por vencer y vencidos del día.
 */
export function CourseAdminDigest({ rows }: CourseAdminDigestProps) {
  const countLabel = `${rows.length} registro${rows.length === 1 ? "" : "s"}`;
  return (
    <EmailLayout title="Cursos — vigencias">
      <Text style={styles.paragraph}>
        Resumen de cursos que requieren atención ({countLabel}):
      </Text>
      <Section style={styles.tableWrap}>
        {rows.map((row, index) => (
          <Text key={`${row.crewRun}-${row.courseName}-${index}`} style={styles.row}>
            <strong>{row.crewName}</strong> · {row.crewRun || "—"} ·{" "}
            {row.courseName} · {row.expiresLabel} · {row.estado}
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
