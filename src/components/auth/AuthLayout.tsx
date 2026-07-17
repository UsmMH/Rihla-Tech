import { useState, type CSSProperties, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

import LogoMark from "@/components/layout/LogoMark";
import { lightTheme } from "@/themes";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export const authInputStyle: CSSProperties = {
  background: lightTheme.inputBg,
  border: `1px solid ${lightTheme.inputBorder}`,
  color: lightTheme.inputText,
  fontFamily: "system-ui, sans-serif",
};

export const authLabelStyle: CSSProperties = {
  color: lightTheme.body,
  fontFamily: "system-ui, sans-serif",
  fontSize: "0.875rem",
  fontWeight: 500,
};

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  hint?: string;
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  hint,
}: PasswordFieldProps) {
  const theme = lightTheme;
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor={id} style={authLabelStyle}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          className="w-full rounded-xl px-4 py-3 pr-12 outline-none min-h-[48px] text-base"
          style={authInputStyle}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md cursor-pointer"
          style={{ background: "none", border: "none", color: theme.muted }}
        >
          {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
      {hint && (
        <p className="text-xs" style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const theme = lightTheme;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background: `linear-gradient(180deg, ${theme.sectionAlt} 0%, ${theme.pageBg} 100%)`,
      }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <LogoMark size={32} variant="dark" />
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.5rem" }}>
              <span style={{ color: theme.heading }}>Rihla</span>
              <span style={{ color: theme.accentSky }}>Tech</span>
            </span>
          </div>
          <h1
            className="font-dm-serif text-3xl mb-2"
            style={{ color: theme.heading, fontFamily: "'DM Serif Display', serif" }}
          >
            {title}
          </h1>
          <p style={{ color: theme.muted, fontSize: "0.9rem", fontFamily: "system-ui, sans-serif" }}>
            {subtitle}
          </p>
        </div>

        <div
          className="rounded-2xl border p-6"
          style={{
            background: theme.cardBgGradient,
            borderColor: theme.cardBorder,
            boxShadow: theme.cardShadow,
          }}
        >
          {children}
        </div>

        <div
          className="text-center mt-6 text-sm"
          style={{ color: theme.muted, fontFamily: "system-ui, sans-serif" }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}
