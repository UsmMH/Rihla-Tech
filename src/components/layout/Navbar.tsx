import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LogoMark from "@/components/layout/LogoMark";
import { useTheme } from "@/contexts/ThemeContext";
import { navigate, type AppTab } from "@/lib/navigation";

type NavbarProps = {
  variant?: "marketing" | "app";
  activePage?: AppTab;
  onNavigate?: (tab: AppTab) => void;
  onHome?: () => void;
  onStart?: () => void;
};

const MARKETING_ITEMS = [
  { label: "Features", sectionId: "features" },
  { label: "How it Works", sectionId: "how-it-works" },
  { label: "Destinations", sectionId: "destinations" },
] as const;

const APP_ITEMS: { label: string; tab: AppTab }[] = [
  { label: "Home", tab: "home" },
  { label: "My Trips", tab: "my-trips" },
  { label: "Community", tab: "community" },
  { label: "Profile", tab: "profile" },
];

export default function Navbar({
  variant = "app",
  activePage,
  onNavigate,
  onHome,
  onStart,
}: NavbarProps) {
  const { theme, isDark } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogoClick() {
    if (variant === "app") {
      onNavigate?.("home");
      onHome?.();
    } else {
      onHome?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setMenuOpen(false);
  }

  function scrollToSection(sectionId: string) {
    onHome?.();
    setMenuOpen(false);
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  }

  function goToTab(tab: AppTab) {
    onNavigate?.(tab);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const isMarketing = variant === "marketing";

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-6 py-3.5"
        style={{
          background: theme.navBg,
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${theme.navBorder}`,
          minHeight: "60px",
          transition: "background 0.3s, border-color 0.3s",
        }}
      >
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 group cursor-pointer flex-shrink-0"
          style={{ background: "none", border: "none", padding: 0 }}
        >
          <LogoMark size={28} variant={isDark ? "light" : "dark"} />
          <span
            style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem", letterSpacing: "-0.01em" }}
            className="group-hover:opacity-90 transition-opacity"
          >
            <span style={{ color: theme.navLogoText, transition: "color 0.3s" }}>Rihla</span>
            <span style={{ color: theme.accentSky, transition: "color 0.3s" }}>Tech</span>
          </span>
        </button>

        {isMarketing ? (
          <div className="hidden md:flex items-center gap-7">
            {MARKETING_ITEMS.map((item) => (
              <button
                key={item.sectionId}
                onClick={() => scrollToSection(item.sectionId)}
                className="text-sm transition-colors cursor-pointer"
                style={{ color: theme.navLinkText, background: "none", border: "none", fontFamily: "system-ui, sans-serif" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = theme.navLinkHover)}
                onMouseLeave={(e) => (e.currentTarget.style.color = theme.navLinkText)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-1">
            {APP_ITEMS.map((item) => {
              const isActive = activePage === item.tab;
              return (
                <button
                  key={item.tab}
                  onClick={() => goToTab(item.tab)}
                  className="text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer"
                  style={{
                    color: isActive ? theme.accentSky : theme.navLinkText,
                    background: isActive ? theme.badgeBg : "none",
                    border: "none",
                    fontFamily: "system-ui, sans-serif",
                    fontWeight: isActive ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = theme.navLinkHover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = theme.navLinkText;
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {isMarketing && (
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => navigate("/login")}
              className="text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer"
              style={{ color: theme.navLinkText, background: "none", border: "none", fontFamily: "system-ui, sans-serif" }}
            >
              Log in
            </button>
            <button
              onClick={() => navigate("/register")}
              className="text-sm px-5 py-2 rounded-lg font-medium cursor-pointer transition-all"
              style={{
                background: theme.accentDeep,
                color: "#fff",
                border: `1px solid ${theme.border}`,
                fontFamily: "system-ui, sans-serif",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.accentMid)}
              onMouseLeave={(e) => (e.currentTarget.style.background = theme.accentDeep)}
            >
              Get Started
            </button>
          </div>
        )}

        <div className={`flex items-center gap-2 ${isMarketing ? "md:hidden" : ""}`}>
          {isMarketing && onStart && (
            <button
              onClick={onStart}
              className="text-sm px-4 py-2 rounded-lg font-medium cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
                color: "#fff",
                border: "none",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Plan Trip
            </button>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer md:hidden"
            style={{ background: theme.toggleBg, border: "none" }}
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              {menuOpen ? (
                <path d="M4 4l12 12M16 4L4 16" stroke={theme.toggleIcon} strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke={theme.toggleIcon} strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed top-[60px] left-0 right-0 z-40 px-4 py-3 md:hidden"
            style={{
              background: theme.navMenuBg,
              borderBottom: `1px solid ${theme.navMenuBorder}`,
              backdropFilter: "blur(14px)",
            }}
          >
            {isMarketing ? (
              MARKETING_ITEMS.map((item) => (
                <button
                  key={item.sectionId}
                  onClick={() => scrollToSection(item.sectionId)}
                  className="w-full text-left py-3 text-sm cursor-pointer"
                  style={{
                    color: theme.navLinkText,
                    background: "none",
                    border: "none",
                    borderBottom: `1px solid ${theme.navMenuItemBorder}`,
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {item.label}
                </button>
              ))
            ) : (
              APP_ITEMS.map((item) => (
                <button
                  key={item.tab}
                  onClick={() => goToTab(item.tab)}
                  className="w-full text-left py-3 text-sm cursor-pointer"
                  style={{
                    color: activePage === item.tab ? theme.accentSky : theme.navLinkText,
                    background: "none",
                    border: "none",
                    borderBottom: `1px solid ${theme.navMenuItemBorder}`,
                    fontFamily: "system-ui, sans-serif",
                    fontWeight: activePage === item.tab ? 600 : 400,
                  }}
                >
                  {item.label}
                </button>
              ))
            )}
            {isMarketing && (
              <>
                <button
                  onClick={() => {
                    navigate("/login");
                    setMenuOpen(false);
                  }}
                  className="w-full text-left py-3 text-sm cursor-pointer"
                  style={{ color: theme.navLinkText, background: "none", border: "none", fontFamily: "system-ui, sans-serif" }}
                >
                  Log in
                </button>
                <button
                  onClick={() => {
                    navigate("/register");
                    setMenuOpen(false);
                  }}
                  className="w-full text-left py-3 text-sm cursor-pointer"
                  style={{ color: theme.navLinkText, background: "none", border: "none", fontFamily: "system-ui, sans-serif" }}
                >
                  Get Started
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
