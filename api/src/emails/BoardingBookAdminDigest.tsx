import { Section, Text } from "@react-email/components";
import { EmailLayout } from "./EmailLayout.js";

/** Fila del resumen admin de libretas. */
export type BoardingBookAdminDigestRow = {
  crewName: string;
  crewRun: string;
  validUntilLabel: string;
};

/** Props del digest diario de libretas. */
export type BoardingBookAdminDigestProps = {
  rows: BoardingBookAdminDigestRow[];
};

/**
 * Resumen para admin/superadmin: libretas de embarque por vencer.
 */
export function BoardingBookAdminDigest({
  rows,
}: BoardingBookAdminDigestProps) {
  const countLabel = `${rows.length} registro${rows.length === 1 ? "" : "s"}`;
  return (
    <EmailLayout title="Libretas de embarque por vencer">
      <Text style={styles.paragraph}>
        Resumen de libretas que requieren atención ({countLabel}):
      </Text>
      <Section style={styles.tableWrap}>
        {rows.map((row, index) => (
          <Text
            key={`${row.crewRun}-${row.validUntilLabel}-${index}`}
            style={styles.row}
          >
            <strong>{row.crewName}</strong> · {row.crewRun || "—"} ·{" "}
            {row.validUntilLabel}
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
