/**
 * Responsive grid used for entity card grids (Templates, Integrations, Code
 * Repositories, ...). Uses explicit column counts per breakpoint (plain `1fr` tracks, not
 * Tailwind's `minmax(0, 1fr)`) so cards keep
 * a predictable number per row (e.g. 4 on a laptop, 5 on xl), filling the full
 * width of the page container instead of stretching on very wide monitors.
 */
// Above the xl breakpoint (1536px) there is no larger preset, so a dedicated
// min-width variant adds a 6th column on very wide monitors (>=1920px).
export const ENTITY_CARD_GRID_CLASSES =
  "grid w-full gap-4 grid-cols-[1fr] sm:grid-cols-[repeat(2,1fr)] md:grid-cols-[repeat(3,1fr)] lg:grid-cols-[repeat(4,1fr)] xl:grid-cols-[repeat(5,1fr)] min-[1920px]:grid-cols-[repeat(6,1fr)]";
