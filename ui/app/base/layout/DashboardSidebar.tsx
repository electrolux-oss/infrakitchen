import * as React from "react";

import { matchPath, useLocation } from "react-router";

import { useConfig } from "@electrolux-oss/infrakitchen";
import { cn } from "@electrolux-oss/infrakitchen";
import {
  AccountTreeIcon,
  AdminPanelSettingsIcon,
  ArticleIcon,
  BadgeIcon,
  CodeIcon,
  ConstructionIcon,
  DashboardIcon,
  DiscountOutlinedIcon,
  DoneAllIcon,
  EngineeringIcon,
  ExtensionIcon,
  FolderIcon,
  ImportContactsIcon,
  InventoryIcon,
  KeyIcon,
  LanIcon,
  LayersIcon,
  LibraryBooksIcon,
  MemoryIcon,
  PeopleIcon,
  PlaylistAddCheckIcon,
  ReceiptLongIcon,
  StorageIcon,
  TerminalIcon,
  WorkspacesIcon,
} from "@electrolux-oss/infrakitchen";
import { breakpointUp, useMediaQuery } from "@electrolux-oss/infrakitchen";

import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from "../../constants";
import DashboardSidebarContext from "../../context/DashboardSidebarContext";

import { DashboardAdminSidebar } from "./DashboardAdminSidebar";
import DashboardSidebarDividerItem from "./DashboardSidebarDividerItem";
import DashboardSidebarPageItem from "./DashboardSidebarPageItem";
import DashboardSidebarToggleItem from "./DashboardSidebarToggleItem";
import { drawerTransition } from "./mixins";

export interface DashboardSidebarProps {
  expanded?: boolean;
  setExpanded: (expanded: boolean) => void;
  disableCollapsibleSidebar?: boolean;
}

export default function DashboardSidebar({
  expanded = true,
  setExpanded,
  disableCollapsibleSidebar = false,
}: DashboardSidebarProps) {
  const { pathname } = useLocation();
  const { globalConfig } = useConfig();

  const isOverSmViewport = useMediaQuery(breakpointUp.sm);
  const isOverMdViewport = useMediaQuery(breakpointUp.md);

  const [isFullyExpanded, setIsFullyExpanded] = React.useState(expanded);
  const [isFullyCollapsed, setIsFullyCollapsed] = React.useState(!expanded);

  React.useEffect(() => {
    if (expanded) {
      const drawerWidthTransitionTimeout = setTimeout(() => {
        setIsFullyExpanded(true);
      }, 225);

      return () => clearTimeout(drawerWidthTransitionTimeout);
    }

    setIsFullyExpanded(false);

    return () => {};
  }, [expanded]);

  React.useEffect(() => {
    if (!expanded) {
      const drawerWidthTransitionTimeout = setTimeout(() => {
        setIsFullyCollapsed(true);
      }, 195);

      return () => clearTimeout(drawerWidthTransitionTimeout);
    }

    setIsFullyCollapsed(false);

    return () => {};
  }, [expanded]);

  // On phones the sidebar is a temporary overlay drawer: it is either fully
  // open or hidden, so it never uses the mini (icons-only) layout. Switching
  // to mini while the drawer slides out made items jump around.
  const isPhoneViewport = !isOverSmViewport;
  const mini = !disableCollapsibleSidebar && !expanded && !isPhoneViewport;

  const handleSetSidebarExpanded = React.useCallback(
    (newExpanded: boolean) => () => {
      setExpanded(newExpanded);
    },
    [setExpanded],
  );

  // undefined = auto (expand when a child route is active); once the user
  // toggles a group, their explicit choice wins until they toggle again.
  const [nestedExpanded, setNestedExpanded] = React.useState<
    Record<string, boolean | undefined>
  >({
    templates: true,
    configurations: undefined,
    operations: undefined,
    management: undefined,
  });

  const handlePageItemClick = React.useCallback(
    (itemId: string, hasNestedNavigation: boolean) => {
      if (hasNestedNavigation) {
        // Group parent: toggle its children.
        setNestedExpanded((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
        return;
      }
      if (!isOverSmViewport) {
        setExpanded(false);
      }
    },
    [setExpanded, isOverSmViewport],
  );

  // Auto-expand a group when one of its children is the active route.
  const isTemplateVersionsActive = !!matchPath(
    "/source_code_versions/*",
    pathname,
  );
  const isConfigurationsActive = [
    "/integrations/*",
    "/source_codes/*",
    "/workspaces/*",
    "/storages/*",
    "/secrets/*",
  ].some((pattern) => matchPath(pattern, pathname));
  const isOperationsActive = [
    "/tasks/*",
    "/workflows/*",
    "/workers/*",
    "/tools/*",
  ].some((pattern) => matchPath(pattern, pathname));
  const isManagementActive = [
    "/users/*",
    "/roles/*",
    "/audit_logs/*",
    "/auth_providers/*",
    "/admin/*",
  ].some((pattern) => matchPath(pattern, pathname));

  const templatesExpanded =
    nestedExpanded.templates ?? isTemplateVersionsActive;
  const configurationsExpanded =
    nestedExpanded.configurations ?? isConfigurationsActive;
  const operationsExpanded = nestedExpanded.operations ?? isOperationsActive;
  const managementExpanded = nestedExpanded.management ?? isManagementActive;

  const hasDrawerTransitions =
    isOverSmViewport && (!disableCollapsibleSidebar || isOverMdViewport);

  const getDrawerContent = React.useCallback(
    (viewport: "phone" | "tablet" | "desktop") => (
      <nav
        aria-label={`${viewport.charAt(0).toUpperCase()}${viewport.slice(1)}`}
        className="flex h-full flex-col overflow-hidden"
        style={
          hasDrawerTransitions
            ? { transition: drawerTransition(isFullyExpanded, "padding") }
            : undefined
        }
      >
        <div className="h-14 shrink-0 sm:h-16 max-sm:landscape:h-12" />
        <div
          className={cn(
            mini ? "[scrollbar-gutter:stable]" : "[scrollbar-gutter:auto]",
            "min-h-0 flex-1 overflow-auto overflow-x-hidden",
          )}
        >
          <ul
            // Same top padding in both modes, so items stay at the same
            // vertical position when collapsing/expanding.
            className={cn(
              "m-0 flex list-none flex-col pt-2",
              mini ? "px-0" : "px-2",
            )}
            style={{ width: mini ? MINI_DRAWER_WIDTH : "auto" }}
          >
            <DashboardSidebarPageItem
              id="dashboard"
              title="Dashboard"
              icon={<DashboardIcon />}
              href="/"
              selected={pathname === "/"}
            />
            <DashboardSidebarPageItem
              id="projects"
              title="Projects"
              icon={<FolderIcon />}
              href="/projects"
              selected={!!matchPath("/projects/*", pathname)}
              permissionKey="project"
            />
            {globalConfig?.services && (
              <DashboardSidebarPageItem
                id="services"
                title="Services"
                icon={<LayersIcon />}
                href="/services"
                selected={!!matchPath("/services/*", pathname)}
                permissionKey="service"
              />
            )}
            <DashboardSidebarPageItem
              id="templates"
              title="Templates"
              icon={<LibraryBooksIcon />}
              href="/templates"
              selected={!!matchPath("/templates/*", pathname)}
              permissionKey="template"
              expanded={templatesExpanded}
              nestedNavigation={
                <div className="pl-2.5">
                  {/* The parent "Templates" entry is only needed in the
                      collapsed flyout; when expanded, the group header itself
                      is the visible link. */}
                  {mini && (
                    <DashboardSidebarPageItem
                      id="templates_all"
                      title="Templates"
                      icon={<LibraryBooksIcon />}
                      href="/templates"
                      selected={
                        pathname === "/templates" ||
                        !!matchPath("/templates/*", pathname)
                      }
                      permissionKey="template"
                    />
                  )}
                  <DashboardSidebarPageItem
                    id="source_code_versions"
                    title="Template Versions"
                    icon={<DiscountOutlinedIcon />}
                    href="/source_code_versions"
                    selected={!!matchPath("/source_code_versions/*", pathname)}
                    permissionKey="source_code_version"
                  />
                </div>
              }
            />
            <DashboardSidebarPageItem
              id="resources"
              title="Resources"
              icon={<InventoryIcon />}
              href="/resources"
              selected={!!matchPath("/resources/*", pathname)}
              permissionKey="resource"
            />
            <DashboardSidebarPageItem
              id="batch_operations"
              title="Batch Operations"
              icon={<DoneAllIcon />}
              href="/batch_operations"
              selected={!!matchPath("/batch_operations/*", pathname)}
              permissionKey="batch_operation"
            />
            <DashboardSidebarPageItem
              id="executors"
              title="Executors"
              icon={<MemoryIcon />}
              href="/executors"
              selected={!!matchPath("/executors/*", pathname)}
              permissionKey="executor"
            />
            <DashboardSidebarPageItem
              id="blueprints"
              title="Blueprints"
              label="alpha"
              icon={<ArticleIcon />}
              href="/blueprints"
              selected={!!matchPath("/blueprints/*", pathname)}
              permissionKey="blueprint"
            />

            <DashboardSidebarDividerItem />

            <DashboardSidebarPageItem
              id="configurations"
              title="Configurations"
              icon={<LanIcon />}
              expanded={configurationsExpanded}
              nestedNavigation={
                <div className="pl-2.5">
                  <DashboardSidebarPageItem
                    id="integrations"
                    title="Integrations"
                    icon={<ExtensionIcon />}
                    href="/integrations"
                    selected={!!matchPath("/integrations/*", pathname)}
                    permissionKey="integration"
                  />
                  <DashboardSidebarPageItem
                    id="source_codes"
                    title="Code Repositories"
                    icon={<CodeIcon />}
                    href="/source_codes"
                    selected={!!matchPath("/source_codes/*", pathname)}
                    permissionKey="source_code"
                  />
                  <DashboardSidebarPageItem
                    id="workspaces"
                    title="Workspaces"
                    icon={<WorkspacesIcon />}
                    href="/workspaces"
                    selected={!!matchPath("/workspaces/*", pathname)}
                    permissionKey="workspace"
                  />
                  <DashboardSidebarPageItem
                    id="storages"
                    title="Storage"
                    icon={<StorageIcon />}
                    href="/storages"
                    selected={!!matchPath("/storages/*", pathname)}
                    permissionKey="storage"
                  />
                  <DashboardSidebarPageItem
                    id="secrets"
                    title="Secrets"
                    icon={<KeyIcon />}
                    href="/secrets"
                    selected={!!matchPath("/secrets/*", pathname)}
                    permissionKey="secret"
                  />
                  <DashboardSidebarPageItem
                    id="tools"
                    title="IaC Tools"
                    icon={<TerminalIcon />}
                    href="/tools"
                    selected={!!matchPath("/tools/*", pathname)}
                    permissionKey="tool"
                  />
                </div>
              }
            />

            <DashboardSidebarPageItem
              id="operations"
              title="Operations"
              icon={<ConstructionIcon />}
              expanded={operationsExpanded}
              nestedNavigation={
                <div className="pl-2.5">
                  <DashboardSidebarPageItem
                    id="tasks"
                    title="Tasks"
                    icon={<PlaylistAddCheckIcon />}
                    href="/tasks"
                    selected={!!matchPath("/tasks/*", pathname)}
                    permissionKey="task"
                  />
                  <DashboardSidebarPageItem
                    id="workflows"
                    title="Workflows"
                    icon={<AccountTreeIcon />}
                    href="/workflows"
                    selected={!!matchPath("/workflows/*", pathname)}
                    permissionKey="workflow"
                  />
                  <DashboardSidebarPageItem
                    id="workers"
                    title="Workers"
                    icon={<EngineeringIcon />}
                    href="/workers"
                    selected={!!matchPath("/workers/*", pathname)}
                    permissionKey="worker"
                  />
                </div>
              }
            />

            <DashboardSidebarPageItem
              id="management"
              title="Management"
              icon={<AdminPanelSettingsIcon />}
              expanded={managementExpanded}
              nestedNavigation={
                <div className="pl-2.5">
                  <DashboardSidebarPageItem
                    id="users"
                    title="Users"
                    icon={<PeopleIcon />}
                    href="/users"
                    selected={!!matchPath("/users/*", pathname)}
                    permissionKey="user"
                  />
                  <DashboardSidebarPageItem
                    id="roles"
                    title="Roles"
                    icon={<BadgeIcon />}
                    href="/roles"
                    selected={!!matchPath("/roles/*", pathname)}
                    permissionKey="permission"
                  />
                  <DashboardSidebarPageItem
                    id="audit_logs"
                    title="Audit Logs"
                    icon={<ReceiptLongIcon />}
                    href="/audit_logs"
                    selected={!!matchPath("/audit_logs/*", pathname)}
                    permissionKey="audit_log"
                  />
                  <DashboardAdminSidebar />
                </div>
              }
            />

            <DashboardSidebarPageItem
              id="documentation"
              title="Documentation"
              icon={<ImportContactsIcon />}
              href="https://opensource.electrolux.one/infrakitchen/"
            />
          </ul>
        </div>
        {viewport === "desktop" && !disableCollapsibleSidebar ? (
          <DashboardSidebarToggleItem
            expanded={expanded}
            setExpanded={setExpanded}
          />
        ) : null}
      </nav>
    ),
    [
      mini,
      hasDrawerTransitions,
      isFullyExpanded,
      pathname,
      expanded,
      setExpanded,
      disableCollapsibleSidebar,
      templatesExpanded,
      configurationsExpanded,
      operationsExpanded,
      managementExpanded,
      globalConfig?.services,
    ],
  );

  const drawerWidth = mini ? MINI_DRAWER_WIDTH : DRAWER_WIDTH;
  const widthTransition = drawerTransition(expanded, "width");

  // A docked drawer: a spacer that reserves the width in the layout, with
  // the panel absolutely positioned over the full height.
  const renderPermanentDrawer = (
    viewport: "tablet" | "desktop",
    visibility: string,
  ) => (
    <div
      className={cn(
        "relative shrink-0 overflow-x-hidden print:hidden",
        visibility,
      )}
      style={{ width: drawerWidth, transition: widthTransition }}
    >
      <div
        className="absolute inset-y-0 left-0 z-[1200] box-border overflow-x-hidden border-r border-divider bg-canvas"
        style={{ width: drawerWidth, transition: widthTransition }}
      >
        {getDrawerContent(viewport)}
      </div>
    </div>
  );

  const sidebarContextValue = React.useMemo(() => {
    return {
      onPageItemClick: handlePageItemClick,
      mini,
      fullyExpanded: isFullyExpanded || isPhoneViewport,
      fullyCollapsed: isFullyCollapsed && !isPhoneViewport,
      hasDrawerTransitions,
    };
  }, [
    handlePageItemClick,
    mini,
    isFullyExpanded,
    isFullyCollapsed,
    isPhoneViewport,
    hasDrawerTransitions,
  ]);

  return (
    <DashboardSidebarContext.Provider value={sidebarContextValue}>
      {/* Phones (and tablets without collapsing): an overlay drawer that
          slides in over a dimmed backdrop. Kept mounted for fast opening. */}
      <div
        className={cn(
          "print:hidden",
          disableCollapsibleSidebar ? "block md:hidden" : "block sm:hidden",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "fixed inset-0 z-[1200] bg-black/50 transition-opacity duration-200",
            expanded ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={handleSetSidebarExpanded(false)}
        />
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-[1200] box-border overflow-x-hidden border-r border-divider bg-canvas shadow-[0_8px_10px_-5px_rgba(0,0,0,0.2),0_16px_24px_2px_rgba(0,0,0,0.14),0_6px_30px_5px_rgba(0,0,0,0.12)] transition-transform",
            expanded ? "translate-x-0" : "-translate-x-full",
          )}
          style={{ width: DRAWER_WIDTH }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setExpanded(false);
          }}
        >
          {getDrawerContent("phone")}
        </div>
      </div>
      {renderPermanentDrawer(
        "tablet",
        disableCollapsibleSidebar ? "hidden" : "hidden sm:block md:hidden",
      )}
      {renderPermanentDrawer("desktop", "hidden md:block")}
    </DashboardSidebarContext.Provider>
  );
}
