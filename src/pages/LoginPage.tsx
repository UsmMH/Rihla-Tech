import { FormEvent, useState } from "react";

import { AuthLayout, PasswordField } from "@/components/auth/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { normalizeEmail, validateEmail, validatePassword } from "@/lib/credentialsValidation";
import { lightTheme } from "@/themes";

type LoginPageProps = {
  onSuccess: () => void;
  onGoRegister: () => void;
};

const theme = lightTheme;

const inputStyle = {
  background: theme.inputBg,
  border: `1px solid ${theme.inputBorder}`,
  color: theme.inputText,
  fontFamily: "system-ui, sans-serif",
};

const labelStyle = {
  color: theme.body,
  fontFamily: "system-ui, sans-serif",
  fontSize: "0.875rem",
  fontWeight: 500,
};

export default function LoginPage({ onSuccess, onGoRegister }: LoginPageProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ email: normalizeEmail(email), password });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue planning your journey"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={onGoRegister}
            className="underline-offset-4 hover:underline cursor-pointer"
            style={{ color: theme.accentSky, background: "none", border: "none", fontFamily: "inherit" }}
          >
            Create one
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" style={labelStyle}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-xl px-4 py-3 outline-none min-h-[48px] text-base focus:ring-2"
            style={inputStyle}
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {error && (
          <p className="text-sm" style={{ color: "#c62828", fontFamily: "system-ui, sans-serif" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl py-3 font-medium min-h-[48px] cursor-pointer disabled:opacity-60"
          style={{
            background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
            color: "#fff",
            border: "none",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
