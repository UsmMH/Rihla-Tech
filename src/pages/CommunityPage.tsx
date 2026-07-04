import { motion } from "framer-motion";
import { Users } from "lucide-react";
import AppBottomNav from "@/components/layout/AppBottomNav";
import Navbar from "@/components/layout/Navbar";
import { useTheme } from "@/contexts/ThemeContext";
import type { AppTab } from "@/lib/navigation";

type CommunityPageProps = {
  onNavigate: (tab: AppTab) => void;
};

export default function CommunityPage({ onNavigate }: CommunityPageProps) {
  const { theme } = useTheme();

  return (
    <div style={{ background: theme.pageBg, minHeight: "100vh", transition: "background 0.3s" }}>
      <Navbar variant="app" activePage="community" onNavigate={onNavigate} onHome={() => onNavigate("home")} />

      <div
        className="max-w-lg mx-auto px-4 md:px-6 py-8 pb-28 md:pb-12 text-center"
        style={{ paddingTop: "100px" }}
      >
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}` }}
          >
            <Users size={32} color={theme.accentSky} />
          </div>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(1.6rem, 5vw, 2.2rem)",
              color: theme.heading,
              marginBottom: "0.75rem",
            }}
          >
            Community
          </h1>
          <p
            className="mx-auto max-w-sm"
            style={{ color: theme.body, fontFamily: "system-ui, sans-serif", fontSize: "0.95rem", lineHeight: 1.65 }}
          >
            Share trips, discover itineraries from other travelers, and vote on favorites — coming in Phase 7.
          </p>
          <span
            className="inline-block mt-6 px-4 py-2 rounded-full"
            style={{
              background: theme.badgeBg,
              color: theme.badgeText,
              fontSize: "0.78rem",
              fontFamily: "system-ui, sans-serif",
              letterSpacing: "0.04em",
            }}
          >
            COMING SOON
          </span>
        </motion.div>
      </div>

      <AppBottomNav active="community" onNavigate={onNavigate} />
    </div>
  );
}
