import type { ReactNode } from "react";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background: "linear-gradient(180deg, #0D2A55 0%, #0A1628 100%)",
      }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-sky-300 text-sm tracking-[0.2em] uppercase mb-2">RihlaTech</p>
          <h1 className="font-dm-serif text-4xl text-white mb-2">{title}</h1>
          <p className="text-slate-300 text-sm">{subtitle}</p>
        </div>

        <div
          className="rounded-2xl border p-6 shadow-xl"
          style={{
            background: "rgba(10, 22, 40, 0.85)",
            borderColor: "rgba(88, 171, 212, 0.25)",
          }}
        >
          {children}
        </div>

        <div className="text-center mt-6 text-sm text-slate-400">{footer}</div>
      </div>
    </div>
  );
}
