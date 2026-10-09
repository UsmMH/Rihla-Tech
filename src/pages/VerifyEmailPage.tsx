import { FormEvent, useEffect, useRef, useState } from "react";

import { authInputStyle, authLabelStyle, AuthLayout } from "@/components/auth/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { lightTheme } from "@/themes";

type VerifyEmailPageProps = {
  email: string;
  onVerified: () => void;
  onBack: () => void;
  /** Auto-request a fresh code on mount (e.g. arriving here from a "not verified" login attempt, where no code was just sent). */
  autoSendOnMount?: boolean;
};

const theme = lightTheme;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage({ email, onVerified, onBack, autoSendOnMount }: VerifyEmailPageProps) {
  const { verifyEmail, resendVerificationCode } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string>(`We sent a 6-digit code to ${email}.`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sentOnMount = useRef(false);

  useEffect(() => {
    if (!autoSendOnMount || sentOnMount.current) return;
    sentOnMount.current = true;
    resendVerificationCode(email)
      .then(() => setCooldown(RESEND_COOLDOWN_SECONDS))
      .catch(() => {
        // Login already told the user verification is required; a failed
        // silent resend here (e.g. cooldown from a very recent code) isn't
        // worth surfacing — they can still use the manual Resend button.
      });
  }, [autoSendOnMount, email, resendVerificationCode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code.");
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyEmail(email, code.trim());
      onVerified();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || isResending) return;
    setError(null);
    setIsResending(true);
    try {
      const message = await resendVerificationCode(email);
      setInfo(message);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setInfo(err.message);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to resend code");
      }
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the code we sent to finish signing in"
      footer={
        <>
          Wrong email?{" "}
          <button
            type="button"
            onClick={onBack}
            className="underline-offset-4 hover:underline cursor-pointer"
            style={{ color: theme.accentSky, background: "none", border: "none", fontFamily: "inherit" }}
          >
            Back to sign in
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {info && !error && (
          <p className="text-sm" style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>
            {info}
          </p>
        )}

        <div className="space-y-2">
          <label htmlFor="code" style={authLabelStyle}>
            Verification code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            required
            className="w-full rounded-xl px-4 py-3 outline-none min-h-[48px] text-center text-lg tracking-[0.5em]"
            style={authInputStyle}
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
          {isSubmitting ? "Verifying..." : "Verify email"}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
          className="w-full rounded-xl py-2.5 font-medium min-h-[44px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: theme.optionBg,
            color: theme.body,
            border: `1px solid ${theme.border}`,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {isResending ? "Sending..." : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </form>
    </AuthLayout>
  );
}
