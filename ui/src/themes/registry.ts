/**
 * Every selectable visual theme. Adding a theme takes three steps:
 *   1. add `themes/<id>.css` (see themes/index.css for the format),
 *   2. import it in themes/index.css,
 *   3. add an entry here.
 * The id becomes `data-ik-theme` on <html>.
 * `npm run check:themes` (scripts/check-themes.mjs) verifies the three agree
 * and that the theme's colors are readable.
 */
export type ThemeScheme = "light" | "dark";

export interface ThemeDef {
  /** Lowercase letters, digits and dashes (index.html checks this before paint). */
  id: string;
  /** Name shown in the appearance menu. */
  label: string;
  /**
   * Color schemes the theme defines. Omit for both. A single-scheme theme
   * pins the scheme and disables the Light/Dark/System choice.
   */
  schemes?: readonly ThemeScheme[];
}

export const THEMES = [
  { id: "default", label: "Default" },
  { id: "dense", label: "Dense" },
  { id: "snake", label: "Snake" },
] as const satisfies readonly ThemeDef[];

export type UiTheme = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: UiTheme = "default";

/** Schemes a theme supports (both unless it says otherwise). */
export const themeSchemes = (id: UiTheme): readonly ThemeScheme[] =>
  (THEMES.find((theme) => theme.id === id) as ThemeDef | undefined)
    ?.schemes ?? ["light", "dark"];

export const isTheme = (value: unknown): value is UiTheme =>
  THEMES.some((theme) => theme.id === value);
