import type { ReactNode } from "react";

import LogoMark from "@/components/layout/LogoMark";
import { lightTheme } from "@/themes";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

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
