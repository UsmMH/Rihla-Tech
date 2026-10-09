import { apiFetch } from "@/lib/api";

export type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_num: string | null;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string;
};

type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type RegisterAcceptedResponse = {
  email: string;
  message: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_num?: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

const TOKEN_KEY = "rihlatech_token";
const USER_KEY = "rihlatech_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function storeAuth(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function register(input: RegisterInput): Promise<RegisterAcceptedResponse> {
  return apiFetch<RegisterAcceptedResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifyEmail(email: string, code: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export async function resendVerificationCode(email: string): Promise<RegisterAcceptedResponse> {
  return apiFetch<RegisterAcceptedResponse>("/auth/resend-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function fetchMe(): Promise<User> {
  return apiFetch<User>("/auth/me");
}

export function logout(): void {
  clearAuth();
}
