import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useLocation, useNavigate, useParams } from "react-router";

import { HeroChevronDownIcon } from "../../../icons";
import { Menu, MenuItem, Tab, Tabs } from "../../../ui";
import { usePermissionProvider } from "../../context";
import { Label } from "../labels";

import { useEntitySidebar } from "./EntitySidebar";

export interface TabDefinition {
  label: string;
  tabLabel?: ReactNode;
  content: ReactNode;
  requiredPermission?: string;
  permissionAction?: "read" | "write" | "admin";
}

// Tab label with an info-tinted count pill, e.g. "Resources" [0].
export const TabCountLabel = ({
  label,
  count,
}: {
  label: string;
  count: number;
}) => (
  <div className="flex items-center gap-1.5">
    {label}
    <Label label={String(count)} />
  </div>
);

interface TabbedContentProps {
  tabs: TabDefinition[];
  defaultTab?: string;
  userEntityPermissions?: string[];
  onChange?: (label: string) => void;
}

const moreButtonClass =
  "ml-6 inline-flex shrink-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-sans text-body2 font-medium whitespace-nowrap text-fg-muted hover:text-fg";

export const TabbedContent = ({
  tabs,
  defaultTab,
  userEntityPermissions,
  onChange,
}: TabbedContentProps) => {
  const { permissions } = usePermissionProvider();
  const sidebar = useEntitySidebar();
  const { tab: activeTabFromPath } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleTabs = tabs.filter(
    ({ requiredPermission, permissionAction }) => {
      if (!requiredPermission || !permissionAction) return true;
      if (permissions["*"] === "admin") return true;
      if (userEntityPermissions?.includes(permissionAction)) return true;
      const p = permissions[requiredPermission];
      if (!p) return false;
      if (permissionAction === "read") return true;
      if (permissionAction === "write") return p === "write" || p === "admin";
      if (permissionAction === "admin") return p === "admin";
      return false;
    },
  );

  const activeTab = visibleTabs.find(
    (t) => t.label.toLowerCase() === activeTabFromPath?.toLowerCase(),
  );

  useEffect(() => {
    if (!activeTab && visibleTabs.length > 0) {
      const targetLabel = (
        visibleTabs.find((t) => t.label === defaultTab) || visibleTabs[0]
      ).label.toLowerCase();

      const parts = location.pathname.replace(/\/$/, "").split("/");
      if (activeTabFromPath) parts[parts.length - 1] = targetLabel;
      else parts.push(targetLabel);

      navigate(parts.join("/") + location.search, { replace: true });
    }
  }, [
    activeTab,
    activeTabFromPath,
    visibleTabs,
    defaultTab,
    location.pathname,
    location.search,
    navigate,
  ]);

  // Tabs that do not fit the available width collapse into a "More" dropdown
  // instead of scrolling. Widths come from a hidden copy of the full tab row.
  const tabBarRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [overflowLabels, setOverflowLabels] = useState<string[]>([]);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  const tabLabelsKey = visibleTabs.map((t) => t.label).join("\n");
  const activeLabel = activeTab?.label;

  useLayoutEffect(() => {
    const tabBar = tabBarRef.current;
    const measure = measureRef.current;
    if (!tabBar || !measure || !activeLabel) return;

    const labels = tabLabelsKey.split("\n");

    const recompute = () => {
      const widths = Array.from(
        measure.querySelectorAll<HTMLElement>("[data-measure-tab]"),
      ).map((el) => el.offsetWidth + 24); // + gap-6 between tabs
      const moreWidth =
        measure.querySelector<HTMLElement>("[data-measure-more]")
          ?.offsetWidth ?? 0;
      const available = tabBar.clientWidth;
      const total = widths.reduce((sum, w) => sum + w, 0);

      let shown = labels;
      if (total > available) {
        // Leading tabs that fit next to the "More" button.
        let count = 0;
        let used = moreWidth;
        while (count < labels.length && used + widths[count] <= available) {
          used += widths[count];
          count += 1;
        }
        // The active tab always stays in the bar: if it would be hidden, drop
        // trailing tabs until it fits and show it last.
        const activeIndex = labels.indexOf(activeLabel);
        if (activeIndex >= count) {
          while (count > 0 && used + widths[activeIndex] > available) {
            count -= 1;
            used -= widths[count];
          }
          shown = [...labels.slice(0, count), activeLabel];
        } else {
          shown = labels.slice(0, count);
        }
      }

      const hidden = labels.filter((label) => !shown.includes(label));
      setOverflowLabels((prev) =>
        prev.join("\n") === hidden.join("\n") ? prev : hidden,
      );
    };

    recompute();
    // The bar resizes with the window/sidebar; the hidden row resizes when a
    // label changes (e.g. a count chip).
    const observer = new ResizeObserver(recompute);
    observer.observe(tabBar);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [tabLabelsKey, activeLabel]);

  if (!activeTab) return null;

  const selectTab = (label: string) => {
    const parts = location.pathname.replace(/\/$/, "").split("/");
    parts[parts.length - 1] = label.toLowerCase();
    navigate(parts.join("/") + location.search);
    onChange?.(label);
  };

  const overflowTabs = visibleTabs.filter((t) =>
    overflowLabels.includes(t.label),
  );
  const barTabs = visibleTabs.filter((t) => !overflowLabels.includes(t.label));
  // An active tab pulled out of the dropdown is shown last, after the tabs
  // that precede the hidden ones.
  const firstHiddenIndex = visibleTabs.findIndex((t) =>
    overflowLabels.includes(t.label),
  );
  const activePulledIn =
    firstHiddenIndex !== -1 &&
    visibleTabs.indexOf(activeTab) > firstHiddenIndex;
  const orderedBarTabs = activePulledIn
    ? [...barTabs.filter((t) => t !== activeTab), activeTab]
    : barTabs;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative flex min-w-0 items-center border-b border-divider"
        ref={tabBarRef}
      >
        <Tabs
          className="min-w-0"
          value={activeTab.label}
          onChange={(_, v) => selectTab(v)}
        >
          {orderedBarTabs.map(({ label, tabLabel }) => (
            <Tab key={label} label={tabLabel ?? label} value={label} />
          ))}
        </Tabs>
        {overflowTabs.length > 0 && (
          <>
            <button
              type="button"
              className={moreButtonClass}
              onClick={(e) => setMoreAnchor(e.currentTarget)}
              aria-haspopup="menu"
              aria-expanded={Boolean(moreAnchor)}
              aria-label={`More tabs (${overflowTabs.length})`}
            >
              More
              <HeroChevronDownIcon className="size-4 shrink-0" />
            </button>
            <Menu
              anchorEl={moreAnchor}
              open={Boolean(moreAnchor)}
              onClose={() => setMoreAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              {overflowTabs.map(({ label, tabLabel }) => (
                <MenuItem
                  key={label}
                  onClick={() => {
                    setMoreAnchor(null);
                    selectTab(label);
                  }}
                >
                  {tabLabel ?? label}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
        {/* Hidden, non-interactive copy of every tab plus the "More" button,
            used only to measure how many tabs fit. */}
        <div
          className="pointer-events-none invisible absolute top-0 left-0 flex h-0 w-max overflow-hidden whitespace-nowrap"
          ref={measureRef}
          aria-hidden
        >
          {/* Tabs must be rendered inside a Tabs container. */}
          <Tabs className="shrink-0" value={false}>
            {visibleTabs.map(({ label, tabLabel }) => (
              <Tab
                key={label}
                data-measure-tab
                tabIndex={-1}
                label={tabLabel ?? label}
                value={label}
              />
            ))}
          </Tabs>
          <button
            type="button"
            data-measure-more
            tabIndex={-1}
            className={moreButtonClass}
          >
            More
            <HeroChevronDownIcon className="size-4 shrink-0" />
          </button>
        </div>
      </div>
      {sidebar ? (
        <div className="grid grid-cols-[minmax(0,_1fr)] items-start gap-4 lg:grid-cols-[minmax(0,_1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">{activeTab.content}</div>
          {sidebar}
        </div>
      ) : (
        activeTab.content
      )}
    </div>
  );
};
