import * as React from "react";

import { Outlet } from "react-router";

import {
  breakpointUp,
  GradientCircularProgress,
  InfrakitchenLogo,
  useLocalStorage,
  useMediaQuery,
  usePermissionProvider,
} from "@electrolux-oss/infrakitchen";

import DashboardHeader from "./DashboardHeader";
import DashboardSidebar from "./DashboardSidebar";

export default function DashboardLayout() {
  const loading = usePermissionProvider().loading;
  const { get, setKey } = useLocalStorage<Record<string, boolean>>();

  const desktopNavigationStorageKey = "dashboard_desktop_navigation_expanded";

  const [isDesktopNavigationExpanded, setIsDesktopNavigationExpanded] =
    React.useState(() => get(desktopNavigationStorageKey) ?? true);
  const [isMobileNavigationExpanded, setIsMobileNavigationExpanded] =
    React.useState(false);

  const isOverMdViewport = useMediaQuery(breakpointUp.md);

  const isNavigationExpanded = isOverMdViewport
    ? isDesktopNavigationExpanded
    : isMobileNavigationExpanded;

  const setIsNavigationExpanded = React.useCallback(
    (newExpanded: boolean) => {
      if (isOverMdViewport) {
        setIsDesktopNavigationExpanded(newExpanded);
      } else {
        setIsMobileNavigationExpanded(newExpanded);
      }
    },
    [
      isOverMdViewport,
      setIsDesktopNavigationExpanded,
      setIsMobileNavigationExpanded,
    ],
  );

  const handleToggleHeaderMenu = React.useCallback(
    (isExpanded: boolean) => {
      setIsNavigationExpanded(isExpanded);
    },
    [setIsNavigationExpanded],
  );

  React.useEffect(() => {
    setKey(desktopNavigationStorageKey, isDesktopNavigationExpanded);
  }, [isDesktopNavigationExpanded, setKey]);

  const layoutRef = React.useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="flex h-[100vh] items-center justify-center">
        <GradientCircularProgress />
      </div>
    );
  }

  return (
    <div
      // 100vh on mobile browsers includes the area behind the address bar;
      // dvh tracks the actually visible viewport.
      className="relative flex h-[100vh] w-full overflow-hidden supports-[height:100dvh]:h-[100dvh]"
      ref={layoutRef}
    >
      <DashboardHeader
        logo={<InfrakitchenLogo />}
        title="InfraKitchen"
        menuOpen={isNavigationExpanded}
        onToggleMenu={handleToggleHeaderMenu}
      />
      <DashboardSidebar
        expanded={isNavigationExpanded}
        setExpanded={setIsNavigationExpanded}
      />
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <div className="h-12 shrink-0 print:hidden" />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
          <React.Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center">
                <GradientCircularProgress />
              </div>
            }
          >
            <Outlet />
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}
