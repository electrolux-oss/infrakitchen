import * as React from "react";

import { Outlet } from "react-router";

import { getAnnouncementColor } from "../../../common/announcementColors";

import DashboardHeader from "./DashboardHeader";
import DashboardSidebar from "./DashboardSidebar";

import {
  breakpointUp,
  Alert,
  GradientCircularProgress,
  HeroMegaphoneIcon,
  HeroXMarkIcon,
  IconButton,
  InfrakitchenLogo,
  useLocalStorage,
  useConfig,
  useMediaQuery,
  usePermissionProvider,
} from "@/index";

export default function DashboardLayout() {
  const loading = usePermissionProvider().loading;
  const {
    instanceName,
    announcement,
    announcementColor,
    generalSettingsPreviewing,
  } = useConfig();
  const { get, setKey } = useLocalStorage<Record<string, boolean>>();
  const announcementStorage = useLocalStorage<Record<string, string>>();
  // a closed announcement stays closed until its text changes
  const [dismissedAnnouncement, setDismissedAnnouncement] = React.useState(
    () => announcementStorage.get("dismissed_announcement") ?? "",
  );
  const bannerColor = getAnnouncementColor(announcementColor);
  const handleDismissAnnouncement = () => {
    setDismissedAnnouncement(announcement ?? "");
    announcementStorage.setKey("dismissed_announcement", announcement ?? "");
  };

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
      className="flex h-[100vh] w-full flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh]"
      ref={layoutRef}
    >
      {announcement &&
      (generalSettingsPreviewing || announcement !== dismissedAnnouncement) ? (
        <Alert
          severity={bannerColor.severity}
          variant="filled"
          icon={<HeroMegaphoneIcon fontSize="inherit" />}
          // a preview can not be closed, it would hide the saved announcement too
          action={
            generalSettingsPreviewing ? undefined : (
              <IconButton
                size="small"
                className="text-inherit hover:bg-black/10"
                aria-label="Close announcement"
                onClick={handleDismissAnnouncement}
              >
                <HeroXMarkIcon />
              </IconButton>
            )
          }
          className="shrink-0 rounded-none border-x-0 border-t-0 whitespace-pre-line print:hidden"
        >
          {generalSettingsPreviewing ? (
            <span className="mr-2 font-semibold">Preview, not saved yet:</span>
          ) : null}
          {announcement}
        </Alert>
      ) : null}
      <div className="relative flex min-h-0 w-full flex-1 flex-col">
        <DashboardHeader
          logo={<InfrakitchenLogo />}
          title="InfraKitchen"
          subtitle={instanceName}
          menuOpen={isNavigationExpanded}
          onToggleMenu={handleToggleHeaderMenu}
        />
        <div className="h-12 shrink-0 print:hidden" />
        <div className="flex min-h-0 w-full flex-1">
          <DashboardSidebar
            expanded={isNavigationExpanded}
            setExpanded={setIsNavigationExpanded}
          />
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
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
      </div>
    </div>
  );
}
