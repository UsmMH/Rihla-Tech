import { motion } from "framer-motion";

import LogoMark from "@/components/layout/LogoMark";
import { useTheme } from "@/contexts/ThemeContext";

type TripPlanningLoaderProps = {
  title: string;
  subtitle?: string;
};

export default function TripPlanningLoader({ title, subtitle }: TripPlanningLoaderProps) {
  const { theme, isDark } = useTheme();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <motion.div
        animate={{ opacity: [0.7, 1, 0.7], scale: [0.96, 1, 0.96] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="mb-8"
      >
        <LogoMark size={44} variant={isDark ? "light" : "dark"} />
      </motion.div>

      <div className="relative w-14 h-14 mb-6" aria-hidden>
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `2px solid ${theme.progressTrack}` }}
        />
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid transparent`,
            borderTopColor: theme.accentSky,
            borderRightColor: theme.accentMid,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-2 rounded-full"
          style={{
            border: `2px solid transparent`,
            borderBottomColor: theme.accentDeep,
          }}
          animate={{ rotate: -360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <p
        style={{
          color: theme.heading,
          fontFamily: "'DM Serif Display', serif",
          fontSize: "1.15rem",
          marginBottom: subtitle ? 8 : 0,
        }}
      >
        {title}
      </p>
      {subtitle && (
        <p style={{ color: theme.muted, fontFamily: "system-ui, sans-serif", fontSize: "0.85rem", maxWidth: 280, lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
