import {
  createContext,
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
import { ApiError, loginRequest } from "../api/auth";

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setTokenState] = useState<string | null>(() =>
    getAccessToken(),
  );
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    return subscribeSession(() => {
      setTokenState(getAccessToken());
    });
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const result = await loginRequest(email, password);
    setAccessToken(result.accessToken);
    setUser(result.user);
  }

  function logout(): void {
    clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ accessToken, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}

export { ApiError };
