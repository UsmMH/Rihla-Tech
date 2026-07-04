import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LogOut, Mail, Moon, Sun, User } from "lucide-react";
import AppBottomNav from "@/components/layout/AppBottomNav";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import { fetchMe } from "@/lib/auth";
import type { AppTab } from "@/lib/navigation";

type ProfilePageProps = {
  onNavigate: (tab: AppTab) => void;
};

export default function ProfilePage({ onNavigate }: ProfilePageProps) {
  const { theme, isDark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(!user?.email);

  useEffect(() => {
    fetchMe()
      .then((me) => setEmail(me.email))
      .catch((err: unknown) => {
        if (err instanceof ApiError && user?.email) setEmail(user.email);
      })
      .finally(() => setLoading(false));
  }, [user?.email]);

  const displayName = user ? `${user.first_name} ${user.last_name}`.trim() : "Account";

  return (
    <div style={{ background: theme.pageBg, minHeight: "100vh", transition: "background 0.3s" }}>
      <Navbar variant="app" activePage="profile" onNavigate={onNavigate} onHome={() => onNavigate("home")} />

      <div
        className="max-w-lg mx-auto px-4 md:px-6 py-8 pb-28 md:pb-12"
        style={{ paddingTop: "80px" }}
      >
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(1.6rem, 5vw, 2.2rem)",
              color: theme.heading,
              marginBottom: "1.5rem",
            }}
          >
            Profile
          </h1>

          <div
            className="rounded-2xl p-5 mb-4 flex items-center gap-4"
            style={{ background: theme.activityCardBg, border: `1px solid ${theme.activityCardBorder}` }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})` }}
            >
              <User size={26} color="#fff" />
            </div>
            <div className="min-w-0">
              <p style={{ fontFamily: "'DM Serif Display', serif", color: theme.heading, fontSize: "1.15rem" }}>
                {displayName}
              </p>
              <p
                className="flex items-center gap-1.5 mt-0.5 truncate"
                style={{ color: theme.muted, fontSize: "0.85rem", fontFamily: "system-ui, sans-serif" }}
              >
                <Mail size={14} className="flex-shrink-0" />
                {loading ? "Loading..." : email}
              </p>
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden mb-4"
            style={{ border: `1px solid ${theme.border}` }}
          >
            <button
              type="button"
              onClick={toggle}
              className="w-full flex items-center justify-between px-4 py-4 cursor-pointer min-h-[56px]"
              style={{ background: theme.optionBg, border: "none" }}
            >
              <div className="flex items-center gap-3">
                {isDark ? <Moon size={20} color={theme.accentSky} /> : <Sun size={20} color={theme.accentSky} />}
                <span style={{ color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.95rem" }}>
                  Appearance
                </span>
              </div>
              <span style={{ color: theme.muted, fontFamily: "system-ui, sans-serif", fontSize: "0.85rem" }}>
                {isDark ? "Dark" : "Light"}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full rounded-2xl px-4 py-4 flex items-center justify-center gap-2 cursor-pointer min-h-[52px]"
            style={{
              background: theme.optionBg,
              border: `1px solid ${theme.border}`,
              color: "#e57373",
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.95rem",
              fontWeight: 500,
            }}
          >
            <LogOut size={18} />
            Log out
          </button>
        </motion.div>
      </div>

      <AppBottomNav active="profile" onNavigate={onNavigate} />
    </div>
  );
}
