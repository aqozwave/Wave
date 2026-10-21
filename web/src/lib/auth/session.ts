/**
 * Sesión web: access token solo en memoria (no localStorage).
 * El refresh vive en cookie HttpOnly vía proxy Vite.
 */

/** Listener notificado cuando cambia el access token. */
type SessionListener = () => void;

/** Access JWT actual; null = sin sesión. */
let accessToken: string | null = null;

/** Suscriptores del AuthContext (y futuros clientes). */
const listeners = new Set<SessionListener>();

/** Avisa a todos los listeners tras un cambio de token. */
function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Devuelve el access token en memoria (o null). */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Guarda o limpia el access token y notifica. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
  notify();
}

/** Borra el access token (logout local / sesión inválida). */
export function clearSession(): void {
  accessToken = null;
  notify();
}

/**
 * Suscribe un listener a cambios de sesión.
 * Devuelve unsubscribe para el cleanup de useEffect.
 */
export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
