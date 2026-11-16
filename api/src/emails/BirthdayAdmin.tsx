import { Section, Text } from "@react-email/components";
import { PRODUCT_NAME } from "./emailBrand.js";
import { EmailLayout } from "./EmailLayout.js";

/** Props del aviso de cumpleaños a admin / RR.HH. */
export type BirthdayAdminProps = {
  personName: string;
  personRun: string;
  personKindLabel: string;
};

/**
 * Correo a quien tiene el permiso birthdays.notifications:
 * hoy cumple años un usuario o embarcado de su empresa.
 */
export function BirthdayAdmin({
  personName,
  personRun,
  personKindLabel,
}: BirthdayAdminProps) {
  return (
    <EmailLayout title="Cumpleaños">
      <Text style={styles.paragraph}>
        Hoy cumple años una persona de tu empresa en {PRODUCT_NAME}.
      </Text>
      <Section style={styles.box}>
        <Text style={styles.boxLine}>
          <strong>Nombre:</strong> {personName}
        </Text>
        <Text style={styles.boxLine}>
          <strong>RUN:</strong> {personRun || "—"}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Tipo:</strong> {personKindLabel}
        </Text>
      </Section>
      <Text style={styles.muted}>
        Aviso automático diario. No requiere que la persona use el portal.
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
    margin: "12px 0 20px",
    padding: "12px 14px",
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
  },
  boxLine: {
    margin: "0 0 8px",
    color: "#0f172a",
    fontSize: "14px",
    lineHeight: "1.45",
  },
  muted: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "1.55",
  },
};
