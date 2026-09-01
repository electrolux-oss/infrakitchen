import type { SystemStyleObject, Theme } from "@mui/system";

/**
 * Responsive grid used for entity card grids (Templates, Integrations, Code
 * Repositories, ...). Uses explicit column counts per breakpoint so cards keep
 * a predictable number per row (e.g. 4 on a laptop, 5 on xl), filling the full
 * width of the page container instead of stretching on very wide monitors.
 */
export const entityCardGridSx = (): SystemStyleObject<Theme> => ({
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, 1fr)",
    md: "repeat(3, 1fr)",
    lg: "repeat(4, 1fr)",
    xl: "repeat(5, 1fr)",
  },
  // Above the default xl breakpoint (1536px) there is no larger preset, so a
  // dedicated media query adds a 6th column on very wide monitors (>=1920px).
  "@media (min-width: 1920px)": {
    gridTemplateColumns: "repeat(6, 1fr)",
  },
  gap: 2,
  width: "100%",
});
