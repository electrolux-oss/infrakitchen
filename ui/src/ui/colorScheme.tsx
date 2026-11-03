import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_THEME,
  isTheme,
  themeSchemes,
  UiTheme,
} from "../themes/registry";

import { useMediaQuery } from "./useMediaQuery";

export type { ThemeDef, ThemeScheme, UiTheme } from "../themes/registry";
export { THEMES } from "../themes/registry";

export type ColorSchemeMode = "light" | "dark" | "system";
export type ResolvedColorScheme = "light" | "dark";

/** localStorage keys for the chosen mode and theme; index.html reads both before paint. */
const COLOR_SCHEME_STORAGE_KEY = "ik-color-mode";
const THEME_STORAGE_KEY = "ik-theme";

const isMode = (value: unknown): value is ColorSchemeMode =>
  value === "light" || value === "dark" || value === "system";

function readStored<T>(
  key: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
): T {
  try {
    const stored = localStorage.getItem(key);
    return isValid(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the choice lasts for this page load only.
  }
}

/** Drops a stored theme id that is no longer in the registry. */
function dropStaleTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored !== null && !isTheme(stored)) {
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable: nothing to clean up.
  }
}

interface ColorSchemeContextValue {
  /** The chosen mode, possibly "system". */
  mode: ColorSchemeMode;
  /**
   * The scheme in effect: `mode`, or the OS preference when "system", limited
   * to the schemes the current theme supports.
   */
  resolvedMode: ResolvedColorScheme;
  /** Schemes the current theme supports; the mode menu disables the rest. */
  availableSchemes: readonly ResolvedColorScheme[];
  setMode: (mode: ColorSchemeMode) => void;
  /** The chosen visual theme. */
  theme: UiTheme;
  setTheme: (theme: UiTheme) => void;
}

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

/**
 * Owns the light/dark choice and the visual theme: persists both, follows the
 * OS preference in "system" mode, syncs with other tabs, and sets
 * `data-color-scheme` and `data-ik-theme` on <html>, which the palette
 * variables in styles.css and themes/*.css key on.
 */
export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorSchemeMode>(() =>
    readStored(COLOR_SCHEME_STORAGE_KEY, isMode, "system"),
  );
  const [theme, setThemeState] = useState<UiTheme>(() => {
    dropStaleTheme();
    return readStored(THEME_STORAGE_KEY, isTheme, DEFAULT_THEME);
  });
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const availableSchemes = themeSchemes(theme);
  const wanted: ResolvedColorScheme =
    mode === "system" ? (prefersDark ? "dark" : "light") : mode;
  const resolvedMode: ResolvedColorScheme = availableSchemes.includes(wanted)
    ? wanted
    : availableSchemes[0];

  useLayoutEffect(() => {
    document.documentElement.dataset.colorScheme = resolvedMode;
  }, [resolvedMode]);

  // Also replaces an unknown id that index.html let through.
  useLayoutEffect(() => {
    document.documentElement.dataset.ikTheme = theme;
  }, [theme]);

  // A change made in another tab arrives as a storage event.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === COLOR_SCHEME_STORAGE_KEY) {
        setModeState(isMode(event.newValue) ? event.newValue : "system");
      } else if (event.key === THEME_STORAGE_KEY) {
        setThemeState(isTheme(event.newValue) ? event.newValue : DEFAULT_THEME);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((next: ColorSchemeMode) => {
    setModeState(next);
    writeStored(COLOR_SCHEME_STORAGE_KEY, next);
  }, []);

  const setTheme = useCallback((next: UiTheme) => {
    setThemeState(next);
    writeStored(THEME_STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      resolvedMode,
      availableSchemes,
      setMode,
      theme,
      setTheme,
    }),
    // availableSchemes is derived from the theme and stable per theme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, resolvedMode, setMode, theme, setTheme],
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
