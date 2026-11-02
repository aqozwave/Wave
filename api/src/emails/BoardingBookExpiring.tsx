import { Section, Text } from "@react-email/components";
import { PRODUCT_NAME } from "./emailBrand.js";
import { EmailLayout } from "./EmailLayout.js";

/** Props del aviso de libreta por vencer. */
export type BoardingBookExpiringProps = {
  crewName: string;
  validUntilLabel: string;
  daysLeft: number;
};

/**
 * Correo al tripulante: libreta de embarque por vencer.
 * Solo informativo; no pide respuesta.
 */
export function BoardingBookExpiring({
  crewName,
  validUntilLabel,
  daysLeft,
}: BoardingBookExpiringProps) {
  return (
    <EmailLayout title="Tu libreta de embarque está por vencer">
      <Text style={styles.paragraph}>
        Hola <strong>{crewName}</strong>,
      </Text>
      <Text style={styles.paragraph}>
        Te recordamos que la vigencia de tu libreta de embarque vencerá el{" "}
        {validUntilLabel}
        {daysLeft >= 0
          ? ` (en ${daysLeft} día${daysLeft === 1 ? "" : "s"})`
          : ""}
        .
      </Text>
      <Section style={styles.box}>
        <Text style={styles.boxLine}>
          <strong>Tripulante:</strong> {crewName}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Vigencia libreta:</strong> {validUntilLabel}
        </Text>
      </Section>
      <Text style={styles.muted}>
        Este correo es solo un aviso. Si ya renovaste la libreta, avisá al
        personal de Personas de {PRODUCT_NAME}.
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
