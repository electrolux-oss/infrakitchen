import { useSyncExternalStore } from "react";

/**
 * Tracks a CSS media query. Breakpoints match
 * styles.css: sm 600px, md 900px, lg 1200px, xl 1536px.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** min-width queries for the theme breakpoints. */
export const breakpointUp = {
  sm: "(min-width: 600px)",
  md: "(min-width: 900px)",
  lg: "(min-width: 1200px)",
  xl: "(min-width: 1536px)",
} as const;
