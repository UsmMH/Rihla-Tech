import LogoMark from "@/components/layout/LogoMark";
import { useTheme } from "@/contexts/ThemeContext";

const FOOTER_LINKS = [
  { label: "Features", sectionId: "features" },
  { label: "How it Works", sectionId: "how-it-works" },
  { label: "Destinations", sectionId: "destinations" },
] as const;

export default function Footer() {
  const { theme, isDark } = useTheme();

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <footer style={{ background: theme.footerBg, borderTop: `1px solid ${theme.border}`, transition: "background 0.3s" }}>
      <div className="max-w-6xl mx-auto px-5 py-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-8">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <LogoMark size={22} variant={isDark ? "light" : "dark"} />
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", color: theme.heading }}>
                Rihla<span style={{ color: theme.accentSky }}>Tech</span>
              </span>
            </div>
            <p
              style={{
                color: theme.muted,
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 600,
                fontSize: "1rem",
                fontStyle: "italic",
                lineHeight: 1.5,
              }}
            >
              Powered by AI, driven by you.
            </p>
          </div>

          <div>
            <h4
              style={{
                color: theme.accentLabel,
                fontSize: "0.72rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: "0.9rem",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Explore
            </h4>
            <ul className="space-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.sectionId}>
                  <button
                    onClick={() => scrollToSection(link.sectionId)}
                    style={{
                      color: theme.muted,
                      fontSize: "0.88rem",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "system-ui, sans-serif",
                      padding: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = theme.heading)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = theme.muted)}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${theme.borderFaint}`,
            paddingTop: "1.25rem",
          }}
        >
          <p style={{ color: theme.faint, fontSize: "0.78rem", fontFamily: "system-ui, sans-serif" }}>
            © 2026 RihlaTech. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
