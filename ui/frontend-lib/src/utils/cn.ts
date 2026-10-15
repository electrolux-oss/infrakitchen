import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom typography sizes from styles.css so that
// `text-body2` is treated as a font size, not a text color.
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
  },
});

// Joins conditional class names and resolves conflicting Tailwind utilities,
// letting a caller's className override a component's defaults.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
