// Design tokens shared by the app theme and component styling.

// Fixed-width stack for code-like content (IDs, config values, logs). Single
// source of truth referenced by the app theme and every code-font usage, so
// the code font is changeable in one place. Geist Mono is bundled (see
// app/main.tsx); the system mono stack is the fallback.
export const CODE_FONT_FAMILY =
  '"Geist Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
