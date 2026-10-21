import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearSession,
  getAccessToken,
  setAccessToken,
  subscribeSession,
} from "./session";
import type { AuthUser, MfaChallenge } from "../api/auth";
import {
  ApiError,
  isMfaChallenge,
  loginRequest,
  logoutRequest,
  meRequest,
  refreshRequest,
  verifyMfaRequest,
} from "../api/auth";

/** Estado expuesto a pantallas y layouts protegidos. */
type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  /** true mientras se llama a /me (o refresh) al entrar al shell. */
  hydrating: boolean;
  /**
   * Login: si hay MFA, devuelve el challenge (sin tokens).
   * Si no, guarda sesión y retorna null.
   */
  login: (
    email: string,
    password: string,
  ) => Promise<MfaChallenge | null>;
  /** Completa MFA y guarda sesión. */
  verifyMfa: (challengeId: string, code: string) => Promise<void>;
  /** Cierra sesión en API (cookie + tokenVersion) y limpia el cliente. */
  logout: () => Promise<void>;
  /** Revalida sesión con GET /me; si falla, intenta refresh. */
  hydrateSession: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/** Tiempo mínimo del skeleton al entrar (evita flash si /me es muy rápido). */
const MIN_HYDRATE_MS = 450;

/** Proveedor de sesión: token en memoria + perfil vía /me. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setTokenState] = useState<string | null>(() =>
    getAccessToken(),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrating, setHydrating] = useState(false);

  useEffect(() => {
    return subscribeSession(() => {
      setTokenState(getAccessToken());
    });
  }, []);

  /**
   * Limpia solo el estado local (token + user).
   * Usado tras logout API o si refresh/me fallan.
   */
  const clearLocal = useCallback((): void => {
    clearSession();
    setUser(null);
  }, []);

  /**
   * POST /logout si hay Bearer; siempre limpia el cliente.
   * Si la API falla, igual sacamos al usuario del panel.
   */
  const logout = useCallback(async (): Promise<void> => {
    const token = getAccessToken();
    if (token) {
      try {
        await logoutRequest(token);
      } catch {
        // Red o 401: igual limpiamos memoria y cookie ya puede haber caducado.
      }
    }
    clearLocal();
  }, [clearLocal]);

  /**
   * Llama GET /me; si el access expiró, intenta POST /refresh con la cookie.
   * Mantiene el skeleton al menos MIN_HYDRATE_MS.
   */
  const hydrateSession = useCallback(async (): Promise<void> => {
    let token = getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }

    setHydrating(true);
    const startedAt = Date.now();

    try {
      try {
        const result = await meRequest(token);
        setUser(result.user);
      } catch {
        // Access vencido o inválido: renovar con cookie HttpOnly.
        const refreshed = await refreshRequest();
        setAccessToken(refreshed.accessToken);
        setUser(refreshed.user);
        token = refreshed.accessToken;
      }
    } catch {
      clearLocal();
    } finally {
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, MIN_HYDRATE_MS - elapsed);
      if (wait > 0) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, wait);
        });
      }
      setHydrating(false);
    }
  }, [clearLocal]);

  /**
   * Login: MFA → challenge; sin MFA → tokens en memoria.
   */
  async function login(
    email: string,
    password: string,
  ): Promise<MfaChallenge | null> {
    const result = await loginRequest(email, password);
    if (isMfaChallenge(result)) {
      return result;
    }
    setAccessToken(result.accessToken);
    setUser(result.user);
    return null;
  }

  /** Tras el código del mail: emite sesión como un login completo. */
  async function verifyMfa(challengeId: string, code: string): Promise<void> {
    const result = await verifyMfaRequest(challengeId, code);
    setAccessToken(result.accessToken);
    setUser(result.user);
  }

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        user,
        hydrating,
        login,
        verifyMfa,
        logout,
        hydrateSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Hook de auth; falla si se usa fuera del provider. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}

export { ApiError };
