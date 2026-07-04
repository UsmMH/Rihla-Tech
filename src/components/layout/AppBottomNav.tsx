import { Home, Map, Users } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import type { AppTab } from "@/lib/navigation";

type AppBottomNavProps = {
  active: AppTab;
  onNavigate: (tab: AppTab) => void;
};

const TABS: { id: AppTab; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "my-trips", label: "My Trips", Icon: Map },
  { id: "community", label: "Community", Icon: Users },
];

export default function AppBottomNav({ active, onNavigate }: AppBottomNavProps) {
  const { theme } = useTheme();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-stretch justify-around px-1"
      style={{
        background: theme.navBg,
        backdropFilter: "blur(14px)",
        borderTop: `1px solid ${theme.navBorder}`,
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0.5rem))",
        paddingTop: "0.35rem",
      }}
      aria-label="App navigation"
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 min-h-[52px] cursor-pointer transition-colors"
            style={{ background: "none", border: "none" }}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              size={20}
              color={isActive ? theme.accentSky : theme.muted}
              strokeWidth={isActive ? 2.25 : 1.75}
            />
            <span
              style={{
                fontSize: "0.65rem",
                fontFamily: "system-ui, sans-serif",
                color: isActive ? theme.accentSky : theme.muted,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
