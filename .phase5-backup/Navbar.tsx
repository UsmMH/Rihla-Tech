import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LogoMark from "@/components/layout/LogoMark";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { navigate } from "@/lib/navigation";

type NavbarProps = {
  onHome?: () => void;
  onStart?: () => void;
  onMyTrips?: () => void;
};

const NAV_ITEMS = [
  { label: "Features", sectionId: "features" },
  { label: "How it Works", sectionId: "how-it-works" },
  { label: "Destinations", sectionId: "destinations" },
] as const;

export default function Navbar({ onHome, onStart, onMyTrips }: NavbarProps) {
  const { theme, isDark, toggle } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleHome() {
    onHome?.();
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMenuOpen(false);
  }

  function scrollToSection(sectionId: string) {
    const needsNavigation = Boolean(onHome);
    onHome?.();
    setMenuOpen(false);
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    }, needsNavigation ? 150 : 0);
  }

  function handleLogout() {
    logout();
    setMenuOpen(false);
  }

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
          onClick={handleHome}
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

        <div className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => (
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

        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={toggle}
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-all"
            style={{ background: theme.toggleBg, border: "none" }}
            aria-label="Toggle theme"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="4" stroke={theme.toggleIcon} strokeWidth="1.6" />
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
                  stroke={theme.toggleIcon} strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <path d="M17 10.5A7 7 0 119.5 3 5.5 5.5 0 0017 10.5z" fill={theme.toggleIcon} />
              </svg>
            )}
          </button>
          {isAuthenticated && user ? (
            <>
              {onMyTrips && (
                <button
                  onClick={onMyTrips}
                  className="text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer"
                  style={{ color: theme.navLinkText, background: "none", border: "none", fontFamily: "system-ui, sans-serif" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = theme.navLinkHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = theme.navLinkText)}
                >
                  My Trips
                </button>
              )}
              <span
                className="text-sm px-2"
                style={{ color: theme.navLinkText, fontFamily: "system-ui, sans-serif" }}
              >
                {user.first_name}
              </span>
              <button
                onClick={handleLogout}
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
                Log out
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={toggle}
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: theme.toggleBg, border: "none", flexShrink: 0 }}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="4" stroke={theme.toggleIcon} strokeWidth="1.6" />
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
                  stroke={theme.toggleIcon} strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M17 10.5A7 7 0 119.5 3 5.5 5.5 0 0017 10.5z" fill={theme.toggleIcon} />
              </svg>
            )}
          </button>
          {isAuthenticated && onStart && (
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
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer"
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
            {NAV_ITEMS.map((item) => (
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
            ))}
            {isAuthenticated && user ? (
              <>
                <div
                  className="w-full py-3 text-sm"
                  style={{
                    color: theme.navLinkText,
                    borderBottom: `1px solid ${theme.navMenuItemBorder}`,
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  Signed in as {user.first_name}
                </div>
                {onMyTrips && (
                  <button
                    onClick={() => {
                      onMyTrips();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left py-3 text-sm cursor-pointer"
                    style={{
                      color: theme.navLinkText,
                      background: "none",
                      border: "none",
                      borderBottom: `1px solid ${theme.navMenuItemBorder}`,
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    My Trips
                  </button>
                )}
                {onStart && (
                  <button
                    onClick={() => {
                      onStart();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left py-3 text-sm cursor-pointer"
                    style={{
                      color: theme.navLinkText,
                      background: "none",
                      border: "none",
                      borderBottom: `1px solid ${theme.navMenuItemBorder}`,
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    Plan My Trip
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left py-3 text-sm cursor-pointer"
                  style={{ color: theme.navLinkText, background: "none", border: "none", fontFamily: "system-ui, sans-serif" }}
                >
                  Log out
                </button>
              </>
            ) : (
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
