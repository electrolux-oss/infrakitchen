import { createContext, ReactNode, useContext } from "react";

import { Card } from "../../../ui";
import { CountLabel } from "../labels/CountLabel";

export interface EntitySidebarLayoutProps {
  /** Page content; must include a TabbedContent, which renders the sidebar. */
  children: ReactNode;
  sidebar: ReactNode;
  /** Full-width notice above the tabs. */
  banner?: ReactNode;
}

const EntitySidebarContext = createContext<ReactNode>(null);

/** Context sidebar supplied by the surrounding EntitySidebarLayout, if any. */
export const useEntitySidebar = () => useContext(EntitySidebarContext);

/**
 * Entity detail layout: the tab bar spans the full page width and
 * TabbedContent places the context sidebar to the right of the active tab's
 * content, below the tabs (single column on small screens, sidebar last).
 */
export const EntitySidebarLayout = ({
  children,
  sidebar,
  banner,
}: EntitySidebarLayoutProps) => (
  <EntitySidebarContext.Provider value={sidebar}>
    <div className="flex w-full min-w-0 flex-col gap-4">
      {banner}
      {children}
    </div>
  </EntitySidebarContext.Provider>
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
  title?: string;
  count?: number;
  /** Optional control rendered flush to the right of the section title. */
  action?: ReactNode;
  children: ReactNode;
}

/** Group of sidebar fields, optionally titled, separated from the next by a divider. */
export const SidebarSection = ({
  title,
  count,
  action,
  children,
}: SidebarSectionProps) => (
  <section className="p-4 [&:not(:last-of-type)]:border-b [&:not(:last-of-type)]:border-divider">
    {(title !== undefined || action) && (
      <div
        // Keep the title baseline steady whether or not an action is present.
        className="mb-3 flex min-h-8 items-center justify-between gap-2"
      >
        <h3 className="m-0 text-[0.875rem] font-semibold text-fg-muted">
          {count !== undefined ? (
            <CountLabel label={title ?? ""} count={count} />
          ) : (
            title
          )}
        </h3>
        {action}
      </div>
    )}
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </section>
);
