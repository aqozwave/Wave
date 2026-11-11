import { Section, Text } from "@react-email/components";
import { PRODUCT_NAME } from "./emailBrand.js";
import { EmailLayout } from "./EmailLayout.js";

/** Props del aviso de capacitación vencida. */
export type TrainingExpiredProps = {
  crewName: string;
  trainingName: string;
  expiresLabel: string;
};

/**
 * Correo al tripulante: capacitación Prevención ya vencida.
 */
export function TrainingExpired({
  crewName,
  trainingName,
  expiresLabel,
}: TrainingExpiredProps) {
  return (
    <EmailLayout title="Tu capacitación venció">
      <Text style={styles.paragraph}>
        Hola <strong>{crewName}</strong>,
      </Text>
      <Text style={styles.paragraph}>
        Tu capacitación <strong>{trainingName}</strong> venció el{" "}
        {expiresLabel}. Coordiná la renovación con Prevención.
      </Text>
      <Section style={styles.box}>
        <Text style={styles.boxLine}>
          <strong>Capacitación:</strong> {trainingName}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Venció:</strong> {expiresLabel}
        </Text>
      </Section>
      <Text style={styles.muted}>
        Este correo es solo un aviso de {PRODUCT_NAME}.
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
