import type { AlertSeverity } from "../ui";

export interface AnnouncementColor {
  value: string;
  label: string;
  // the filled Alert tone of the banner, from the theme's severity colors
  severity: AlertSeverity;
  // the same solid color, for the color swatches
  swatch: string;
}

// Full class names so Tailwind can find them in the source.
export const ANNOUNCEMENT_COLORS: AnnouncementColor[] = [
  {
    value: "blue",
    label: "Blue",
    severity: "info",
    swatch: "border-info bg-info text-info-contrast",
  },
  {
    value: "green",
    label: "Green",
    severity: "success",
    swatch: "border-success bg-success text-success-contrast",
  },
  {
    value: "orange",
    label: "Orange",
    severity: "warning",
    swatch: "border-warning bg-warning text-warning-contrast",
  },
  {
    value: "red",
    label: "Red",
    severity: "error",
    swatch: "border-error bg-error text-error-contrast",
  },
];

export const getAnnouncementColor = (value?: string): AnnouncementColor =>
  ANNOUNCEMENT_COLORS.find((color) => color.value === value) ??
  ANNOUNCEMENT_COLORS[0];
