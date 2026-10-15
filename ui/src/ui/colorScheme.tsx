import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import { useMediaQuery } from "./useMediaQuery";

export type ColorSchemeMode = "light" | "dark" | "system";
export type ResolvedColorScheme = "light" | "dark";

/** localStorage key for the chosen mode; index.html reads it before paint. */
const COLOR_SCHEME_STORAGE_KEY = "ik-color-mode";

const isMode = (value: unknown): value is ColorSchemeMode =>
  value === "light" || value === "dark" || value === "system";

function readStoredMode(): ColorSchemeMode {
  try {
    const stored = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    return isMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

interface ColorSchemeContextValue {
  /** The chosen mode, possibly "system". */
  mode: ColorSchemeMode;
  /** The scheme in effect: `mode`, or the OS preference when "system". */
  resolvedMode: ResolvedColorScheme;
  setMode: (mode: ColorSchemeMode) => void;
}

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

/**
 * Owns the light/dark choice: persists it, follows the OS preference in
 * "system" mode and sets `data-color-scheme` on <html>, which the palette
 * variables and the Tailwind `dark:` variant in styles.css key on.
 */
export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorSchemeMode>(readStoredMode);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolvedMode: ResolvedColorScheme =
    mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  useLayoutEffect(() => {
    document.documentElement.dataset.colorScheme = resolvedMode;
  }, [resolvedMode]);

  const setMode = useCallback((next: ColorSchemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts for this page load only.
    }
  }, []);

  const value = useMemo(
    () => ({ mode, resolvedMode, setMode }),
    [mode, resolvedMode, setMode],
  );

  return (
    <ColorSchemeContext.Provider value={value}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorScheme(): ColorSchemeContextValue {
  const context = useContext(ColorSchemeContext);
  if (!context) {
    throw new Error("useColorScheme must be used within ColorSchemeProvider");
  }
  return context;
}
