// Drawer transition: "sharp" easing, 225ms to expand and 195ms to collapse.
export const DRAWER_EASING = "cubic-bezier(0.4, 0, 0.6, 1)";

export function drawerTransition(isExpanded: boolean, property: string) {
  return `${property} ${isExpanded ? 225 : 195}ms ${DRAWER_EASING}`;
}

/** Shared classes for a sidebar row button (page and toggle items). */
export const SIDEBAR_ITEM_CLASS =
  "relative my-0.5 flex w-full cursor-pointer items-center gap-2 rounded-surface border-0 bg-transparent px-2 py-0.5 text-left text-body2 text-fg/70 no-underline outline-none hover:bg-grey-900/5 focus-visible:bg-grey-900/5 dark:hover:bg-grey-100/8 [&_svg]:size-4.5 [&_svg]:text-current [&_svg_[stroke-width]]:stroke-2";

/** Extra classes for the current page's row. */
export const SIDEBAR_ITEM_SELECTED_CLASS =
  "text-fg bg-grey-900/6 hover:bg-grey-900/9 dark:bg-grey-100/12 dark:hover:bg-grey-100/16 [&_svg]:text-fg before:absolute before:top-1/2 before:left-0 before:h-[55%] before:w-[3px] before:-translate-y-1/2 before:rounded-r-[3px] before:bg-primary before:content-['']";
