import { Section, Text } from "@react-email/components";
import { PRODUCT_NAME } from "./emailBrand.js";
import { EmailLayout } from "./EmailLayout.js";

/** Props del aviso de capacitación por vencer. */
export type TrainingExpiringProps = {
  crewName: string;
  trainingName: string;
  expiresLabel: string;
  daysLeft: number;
};

/**
 * Correo al tripulante: capacitación Prevención por vencer.
 */
export function TrainingExpiring({
  crewName,
  trainingName,
  expiresLabel,
  daysLeft,
}: TrainingExpiringProps) {
  return (
    <EmailLayout title="Tu capacitación está por vencer">
      <Text style={styles.paragraph}>
        Hola <strong>{crewName}</strong>,
      </Text>
      <Text style={styles.paragraph}>
        Te recordamos que tu capacitación <strong>{trainingName}</strong>{" "}
        vencerá el {expiresLabel}
        {daysLeft >= 0
          ? ` (en ${daysLeft} día${daysLeft === 1 ? "" : "s"})`
          : ""}
        .
      </Text>
      <Section style={styles.box}>
        <Text style={styles.boxLine}>
          <strong>Capacitación:</strong> {trainingName}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Vence:</strong> {expiresLabel}
        </Text>
      </Section>
      <Text style={styles.muted}>
        Este correo es solo un aviso. Si ya la renovaste, avisá a Prevención de{" "}
        {PRODUCT_NAME}.
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
  box: {
    margin: "20px 0",
    padding: "14px 16px",
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
  },
  boxLine: {
    margin: "0 0 6px",
    color: "#0f172a",
    fontSize: "14px",
    lineHeight: "1.5",
  },
  muted: {
    margin: "16px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "1.55",
  },
};
