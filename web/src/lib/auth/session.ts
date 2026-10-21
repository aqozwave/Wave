// Access token solo en memoria (no localStorage). Refresh va en cookie HttpOnly.

type SessionListener = () => void;

let accessToken: string | null = null;
const listeners = new Set<SessionListener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  notify();
}

export function clearSession(): void {
  accessToken = null;
  notify();
}

export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
