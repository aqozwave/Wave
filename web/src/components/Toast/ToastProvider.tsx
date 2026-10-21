import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Toast, type ToastTone } from "./Toast";

/** Entrada en la cola de toasts. */
type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

/** API pública para disparar toasts desde cualquier pantalla. */
type ToastApi = {
  /** Muestra un toast arriba a la derecha (auto-cierre ~4s). */
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Duración visible del toast (ms). */
const TOAST_MS = 4000;

/** Máximo de toasts apilados a la vez. */
const MAX_TOASTS = 3;

/**
 * Proveedor + viewport fijo (Figma: flotante arriba a la derecha).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = crypto.randomUUID();
      setItems((prev) => [{ id, message, tone }, ...prev].slice(0, MAX_TOASTS));
      window.setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <Toast
              message={item.message}
              tone={item.tone}
              onClose={() => dismiss(item.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Hook para disparar toasts (exige ToastProvider). */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return ctx;
}
