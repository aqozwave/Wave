import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { PenLine } from "lucide-react";
import { Button } from "../Button/Button";
import { Modal } from "../Modal/Modal";
import { TextField } from "../TextField/TextField";
import type { WorkPermitDigitalSignaturePayload } from "../../lib/api/workPermits";

/** Acciones staff que requieren pad + aceptación. */
export type WorkPermitSignKind =
  | "approve"
  | "receive"
  | "close"
  | "reject-close";

type Props = {
  open: boolean;
  kind: WorkPermitSignKind | null;
  /** Nombre sugerido (usuario logueado). */
  defaultSignerName: string;
  /** Código del PT para subtítulo. */
  permitCode?: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (
    payload: WorkPermitDigitalSignaturePayload & { reviewNote?: string },
  ) => void;
};

/** Título según el hito. */
function titleFor(kind: WorkPermitSignKind): string {
  switch (kind) {
    case "approve":
      return "Firmar aprobación";
    case "receive":
      return "Firmar autorización a bordo";
    case "close":
      return "Firmar cierre del trabajo";
    case "reject-close":
      return "Firmar sin cierre";
  }
}

/** Texto del checkbox de aceptación. */
function acceptLabelFor(kind: WorkPermitSignKind): string {
  switch (kind) {
    case "approve":
      return "Confirmo la aprobación de este permiso de trabajo.";
    case "receive":
      return "Confirmo la autorización a bordo de este permiso.";
    case "close":
      return "Confirmo el cierre del trabajo a bordo.";
    case "reject-close":
      return "Confirmo dejar este permiso sin cierre.";
  }
}

/**
 * Modal de firma digital: nombre + checkbox + pad (signature_pad).
 * Prevención (aprobar) y capitán (recibir / cerrar / sin cierre).
 */
export function WorkPermitSignModal({
  open,
  kind,
  defaultSignerName,
  permitCode,
  submitting = false,
  onClose,
  onConfirm,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [accepted, setAccepted] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** Ajusta el canvas al CSS size × devicePixelRatio. */
  function resizePad() {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!canvas || !pad) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);
    pad.clear();
  }

  useEffect(() => {
    if (!open || !kind) return;
    setSignerName(defaultSignerName);
    setAccepted(false);
    setReviewNote("");
    setError(null);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(0, 76, 140)",
      minWidth: 0.8,
      maxWidth: 2.2,
    });
    padRef.current = pad;
    resizePad();

    const onResize = () => resizePad();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      pad.off();
      padRef.current = null;
    };
  }, [open, kind, defaultSignerName]);

  if (!kind) return null;

  function handleClear() {
    padRef.current?.clear();
    setError(null);
  }

  function handleSubmit() {
    const pad = padRef.current;
    const name = signerName.trim();
    if (!name) {
      setError("Indicá el nombre del firmante.");
      return;
    }
    if (!accepted) {
      setError("Debés confirmar la firma.");
      return;
    }
    if (!pad || pad.isEmpty()) {
      setError("Dibujá tu firma en el recuadro.");
      return;
    }
    if (kind === "reject-close" && !reviewNote.trim()) {
      setError("Indicá el motivo de sin cierre.");
      return;
    }
    const signatureImage = pad.toDataURL("image/png");
    onConfirm({
      signerName: name,
      accepted: true,
      signatureImage,
      ...(kind === "reject-close" ? { reviewNote: reviewNote.trim() } : {}),
    });
  }

  return (
    <Modal
      open={open}
      title={titleFor(kind)}
      subtitle={permitCode ? `${permitCode} · firma manuscrita` : undefined}
      icon={PenLine}
      onClose={onClose}
      maxWidthClass="max-w-[560px]"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
            disabled={submitting}
            onClick={onClose}
          >
            Cancelar
          </button>
          <Button
            type="button"
            size="medium"
            className="!w-auto"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Firmando…" : "Firmar y continuar"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Nombre del firmante"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          autoComplete="name"
        />

        {kind === "reject-close" ? (
          <TextField
            label="Motivo de sin cierre"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />
        ) : null}

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Firma manuscrita
            </span>
            <button
              type="button"
              className="text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
              onClick={handleClear}
            >
              Limpiar
            </button>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white">
            <canvas
              ref={canvasRef}
              className="block h-[160px] w-full touch-none"
              aria-label="Área para dibujar la firma"
            />
          </div>
          <p className="m-0 mt-1 text-[12px] text-[var(--color-nachipa-secondary)]">
            Firmá con el mouse o el dedo dentro del recuadro.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-[13px] text-[var(--color-nachipa-body)]">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--color-nachipa-primary)]"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>{acceptLabelFor(kind)}</span>
        </label>

        {error ? (
          <p className="m-0 text-[13px] text-[var(--color-status-danger-fg,#b91c1c)]">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
