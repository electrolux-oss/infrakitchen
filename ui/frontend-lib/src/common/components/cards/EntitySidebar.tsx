import { ReactNode } from "react";

import { Card } from "../../../ui";

export interface EntitySidebarLayoutProps {
  /** Main column: tabs and the rest of the page content. */
  children: ReactNode;
  sidebar: ReactNode;
}

/**
 * GitHub-style entity detail layout: content on the left, context sidebar on
 * the right; collapses to a single column (sidebar last) on small screens.
 */
export const EntitySidebarLayout = ({
  children,
  sidebar,
}: EntitySidebarLayoutProps) => (
  <div className="grid w-full grid-cols-[minmax(0,_1fr)] items-start gap-4 lg:grid-cols-[minmax(0,_1fr)_360px]">
    <div className="flex min-w-0 flex-col gap-4">{children}</div>
    {sidebar}
  </div>
);

export interface EntitySidebarProps {
  ariaLabel: string;
  children: ReactNode;
}

/** Sidebar card holding the SidebarSection groups of an entity detail page. */
export const EntitySidebar = ({ ariaLabel, children }: EntitySidebarProps) => (
  <Card className="p-0" component="aside" aria-label={ariaLabel}>
    {children}
  </Card>
);

export interface SidebarSectionProps {
  title: string;
  count?: number;
  /** Optional control rendered flush to the right of the section title. */
  action?: ReactNode;
  children: ReactNode;
}

/** Titled group of sidebar fields, separated from the next by a divider. */
export const SidebarSection = ({
  title,
  count,
  action,
  children,
}: SidebarSectionProps) => (
  <section className="p-4 [&:not(:last-of-type)]:border-b [&:not(:last-of-type)]:border-divider">
    <div
      // Keep the title baseline steady whether or not an action is present.
      className="mb-3 flex min-h-8 items-center justify-between gap-2"
    >
      <h3 className="m-0 flex items-center gap-2 text-[0.875rem] font-semibold">
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-hover px-1.5 text-[0.75rem] leading-[1.6] font-medium text-fg-muted">
            {count}
          </span>
        )}
      </h3>
      {action}
    </div>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </section>
);
