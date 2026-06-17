import { createContext, useContext, useState, type ReactNode } from "react";

import { darkTheme, lightTheme, type ThemeTokens } from "@/themes";

type ThemeContextValue = {
  theme: ThemeTokens;
  isDark: boolean;
  toggle: () => void;
};

const THEME_STORAGE_KEY = "rihlatech_theme";

function readInitialDark(): boolean {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "dark") return true;
  if (saved === "light") return false;
  return false;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  isDark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(readInitialDark);
  return (
    <ThemeContext.Provider
      value={{
        theme: isDark ? darkTheme : lightTheme,
        isDark,
        toggle: () => {
          setIsDark((d) => {
            const next = !d;
            localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
            return next;
          });
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
