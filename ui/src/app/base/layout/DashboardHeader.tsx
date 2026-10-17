import * as React from "react";

import { Link } from "react-router";

import ThemeSwitcher from "./ThemeSwitcher";
import UserSidebar from "./UserSidebar";

import {
  Label,
  NotificationBell,
  ServerInfoDialog,
  useConfig,
  IconButton,
  Tooltip,
} from "@/index";
import { MenuIcon, MenuOpenIcon } from "@/index";

export interface DashboardHeaderProps {
  logo?: React.ReactNode;
  title?: string;
  menuOpen: boolean;
  onToggleMenu: (open: boolean) => void;
}

export default function DashboardHeader({
  logo,
  title,
  menuOpen,
  onToggleMenu,
}: DashboardHeaderProps) {
  const [serverInfoOpen, setServerInfoOpen] = React.useState(false);
  const { serverInfo } = useConfig();

  const handleMenuOpen = React.useCallback(() => {
    onToggleMenu(!menuOpen);
  }, [menuOpen, onToggleMenu]);

  const handleServerInfoOpen = React.useCallback(() => {
    setServerInfoOpen(true);
  }, []);

  const handleServerInfoClose = React.useCallback(() => {
    setServerInfoOpen(false);
  }, []);

  const getMenuIcon = React.useCallback(
    (isExpanded: boolean) => {
      const expandMenuActionText = "Expand";
      const collapseMenuActionText = "Collapse";

      return (
        <Tooltip
          title={`${isExpanded ? collapseMenuActionText : expandMenuActionText} menu`}
          enterDelay={1000}
        >
          <div>
            <IconButton
              className="border-0 bg-transparent hover:bg-transparent"
              size="small"
              aria-label={`${isExpanded ? collapseMenuActionText : expandMenuActionText} navigation menu`}
              onClick={handleMenuOpen}
            >
              {isExpanded ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          </div>
        </Tooltip>
      );
    },
    [handleMenuOpen],
  );

  return (
    // Header shares the grey canvas color with the sidebar and content, and
    // sits above the drawers.
    <header className="absolute top-0 right-0 left-auto z-[1201] box-border flex w-full shrink-0 flex-col border-0 border-b border-solid border-divider bg-canvas text-fg print:hidden">
      <div className="relative -mx-1.5 flex min-h-12 items-center bg-inherit px-4 sm:-mx-2 sm:px-6">
        <div className="flex w-full min-w-0 flex-row items-center justify-between">
          <div className="flex min-w-0 flex-row items-center">
            <div className="mr-2 block md:hidden">{getMenuIcon(menuOpen)}</div>
            <Link to="/" style={{ textDecoration: "none" }}>
              {logo ? (
                <div className="relative flex items-center [&_svg]:ml-2.5 [&_svg]:size-8">
                  {logo}
                </div>
              ) : null}
            </Link>
            <div className="flex flex-row items-center">
              {title ? (
                <Link to="/" style={{ textDecoration: "none" }}>
                  <h5
                    // 18px / 22px
                    className="m-0 ml-0 text-[1.125rem] leading-[1] font-semibold tracking-[-0.02em] whitespace-nowrap text-fg sm:text-[1.375rem]"
                  >
                    {title}
                  </h5>
                </Link>
              ) : null}
              {serverInfo ? (
                <Label
                  component="button"
                  onClick={handleServerInfoOpen}
                  className="ml-4 hidden self-end hover:bg-selected focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary sm:inline-flex dark:hover:bg-selected"
                  label={
                    <span className="font-mono">{`v${String(
                      serverInfo.version,
                    ).replace(
                      /^v/,
                      "",
                    )}-${serverInfo.sourceCommitShort}`}</span>
                  }
                />
              ) : null}
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-row items-center gap-0.5">
            <div className="flex flex-row items-center -space-x-1">
              <ThemeSwitcher />
              <NotificationBell />
            </div>
            <UserSidebar />
          </div>
        </div>
        <ServerInfoDialog
          open={serverInfoOpen}
          onClose={handleServerInfoClose}
        />
      </div>
    </header>
  );
}
