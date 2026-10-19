import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The custom typography sizes and radius values from styles.css must be
// registered so conflicting classes merge correctly.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "subtitle1",
        "subtitle2",
        "body1",
        "body2",
        "caption",
      ],
    },
    classGroups: {
      rounded: [{ rounded: ["surface", "code"] }],
    },
  },
});

// Joins conditional class names and resolves conflicting Tailwind utilities,
// letting a caller's className override a component's defaults.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
