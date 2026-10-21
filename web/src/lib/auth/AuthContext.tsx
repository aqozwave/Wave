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
import type { AuthUser } from "../api/auth";
import { ApiError, loginRequest, meRequest } from "../api/auth";

/** Estado expuesto a pantallas y layouts protegidos. */
type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  /** true mientras se llama a /me al entrar al shell. */
  hydrating: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Revalida sesión con GET /me (skeleton en el shell). */
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

  /** Limpia token y perfil (vuelve a /login). */
  const logout = useCallback((): void => {
    clearSession();
    setUser(null);
  }, []);

  /**
   * Llama GET /me con el Bearer actual.
   * Mantiene el skeleton al menos MIN_HYDRATE_MS para una entrada suave.
   */
  const hydrateSession = useCallback(async (): Promise<void> => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }

    setHydrating(true);
    const startedAt = Date.now();

    try {
      const result = await meRequest(token);
      setUser(result.user);
    } catch {
      logout();
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
  }, [logout]);

  /** Login + guarda accessToken; el shell luego hidrata con /me. */
  async function login(email: string, password: string): Promise<void> {
    const result = await loginRequest(email, password);
    setAccessToken(result.accessToken);
    // Perfil provisional hasta que hydrateSession confirme con /me.
    setUser(result.user);
  }

  return (
    <AuthContext.Provider
      value={{ accessToken, user, hydrating, login, logout, hydrateSession }}
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
