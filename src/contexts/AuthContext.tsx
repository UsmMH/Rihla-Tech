import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearAuth,
  fetchMe,
  getStoredToken,
  getStoredUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  resendVerificationCode as resendVerificationCodeRequest,
  storeAuth,
  verifyEmail as verifyEmailRequest,
  type LoginInput,
  type RegisterInput,
  type User,
} from "@/lib/auth";
import { clearLastPage } from "@/lib/trips";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<{ email: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<string>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetchMe()
      .then((currentUser) => {
        setUser(currentUser);
        storeAuth(token, currentUser);
      })
      .catch(() => {
        clearAuth();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const result = await loginRequest(input);
    storeAuth(result.access_token, result.user);
    clearLastPage();
    setUser(result.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await registerRequest(input);
    return { email: result.email };
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const result = await verifyEmailRequest(email, code);
    storeAuth(result.access_token, result.user);
    clearLastPage();
    setUser(result.user);
  }, []);

  const resendVerificationCode = useCallback(async (email: string) => {
    const result = await resendVerificationCodeRequest(email);
    return result.message;
  }, []);

  const logout = useCallback(() => {
    logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      verifyEmail,
      resendVerificationCode,
      logout,
    }),
    [user, isLoading, login, register, verifyEmail, resendVerificationCode, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
