import { ChevronLeft } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";

type PlanningBackHeaderProps = {
  onBack: () => void;
};

export const PLANNING_HEADER_HEIGHT_PX = 56;

export default function PlanningBackHeader({ onBack }: PlanningBackHeaderProps) {
  const { theme } = useTheme();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        height: PLANNING_HEADER_HEIGHT_PX,
        background: theme.navBg,
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${theme.navBorder}`,
      }}
    >
      <div className="h-full max-w-5xl mx-auto px-3 flex items-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg cursor-pointer"
          style={{ background: "none", border: "none", color: theme.body }}
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
