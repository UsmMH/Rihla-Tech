import { FormEvent, useState, type CSSProperties } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { lightTheme } from "@/themes";

type RegisterPageProps = {
  onSuccess: () => void;
  onGoLogin: () => void;
};

const theme = lightTheme;

const inputStyle: CSSProperties = {
  background: theme.inputBg,
  border: `1px solid ${theme.inputBorder}`,
  color: theme.inputText,
  fontFamily: "system-ui, sans-serif",
};

const labelStyle: CSSProperties = {
  color: theme.body,
  fontFamily: "system-ui, sans-serif",
  fontSize: "0.875rem",
  fontWeight: 500,
};

export default function RegisterPage({ onSuccess, onGoLogin }: RegisterPageProps) {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        phone_num: phone || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Start your personalized travel planning journey"
      footer={
        <>
          Already have an account?{" "}
          <button
            type="button"
            onClick={onGoLogin}
            className="underline-offset-4 hover:underline cursor-pointer"
            style={{ color: theme.accentSky, background: "none", border: "none", fontFamily: "inherit" }}
          >
            Sign in
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="firstName" style={labelStyle}>
              First name
            </label>
            <input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full rounded-xl px-4 py-3 outline-none min-h-[48px]"
              style={inputStyle}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="lastName" style={labelStyle}>
              Last name
            </label>
            <input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full rounded-xl px-4 py-3 outline-none min-h-[48px]"
              style={inputStyle}
            />
          </div>
        </div>

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
            className="w-full rounded-xl px-4 py-3 outline-none min-h-[48px]"
            style={inputStyle}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" style={labelStyle}>
            Phone (optional)
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl px-4 py-3 outline-none min-h-[48px]"
            style={inputStyle}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" style={labelStyle}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-xl px-4 py-3 outline-none min-h-[48px]"
            style={inputStyle}
          />
        </div>

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
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
