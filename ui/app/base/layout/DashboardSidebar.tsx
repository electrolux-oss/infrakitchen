import * as React from "react";

import { matchPath, useLocation } from "react-router";

import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ArticleIcon from "@mui/icons-material/Article";
import BadgeIcon from "@mui/icons-material/Badge";
import CodeIcon from "@mui/icons-material/Code";
import ConstructionIcon from "@mui/icons-material/Construction";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import EngineeringIcon from "@mui/icons-material/Engineering";
import ExtensionIcon from "@mui/icons-material/Extension";
import FolderIcon from "@mui/icons-material/Folder";
import HistoryIcon from "@mui/icons-material/History";
import InventoryIcon from "@mui/icons-material/Inventory";
import KeyIcon from "@mui/icons-material/Key";
import LanIcon from "@mui/icons-material/Lan";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import MemoryIcon from "@mui/icons-material/Memory";
import PeopleIcon from "@mui/icons-material/People";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import StorageIcon from "@mui/icons-material/Storage";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import { useTheme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import useMediaQuery from "@mui/material/useMediaQuery";

import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from "../../constants";
import DashboardSidebarContext from "../../context/DashboardSidebarContext";

import { DashboardAdminSidebar } from "./DashboardAdminSidebar";
import DashboardSidebarDividerItem from "./DashboardSidebarDividerItem";
import DashboardSidebarPageItem from "./DashboardSidebarPageItem";
import DashboardSidebarToggleItem from "./DashboardSidebarToggleItem";
import {
  getDrawerSxTransitionMixin,
  getDrawerWidthTransitionMixin,
} from "./mixins";

export interface DashboardSidebarProps {
  expanded?: boolean;
  setExpanded: (expanded: boolean) => void;
  disableCollapsibleSidebar?: boolean;
  container?: Element;
}

export default function DashboardSidebar({
  expanded = true,
  setExpanded,
  disableCollapsibleSidebar = false,
  container,
}: DashboardSidebarProps) {
  const theme = useTheme();

  const { pathname } = useLocation();

  const isOverSmViewport = useMediaQuery(theme.breakpoints.up("sm"));
  const isOverMdViewport = useMediaQuery(theme.breakpoints.up("md"));

  const [isFullyExpanded, setIsFullyExpanded] = React.useState(expanded);
  const [isFullyCollapsed, setIsFullyCollapsed] = React.useState(!expanded);

  React.useEffect(() => {
    if (expanded) {
      const drawerWidthTransitionTimeout = setTimeout(() => {
        setIsFullyExpanded(true);
      }, theme.transitions.duration.enteringScreen);

      return () => clearTimeout(drawerWidthTransitionTimeout);
    }

    setIsFullyExpanded(false);

    return () => {};
  }, [expanded, theme.transitions.duration.enteringScreen]);

  React.useEffect(() => {
    if (!expanded) {
      const drawerWidthTransitionTimeout = setTimeout(() => {
        setIsFullyCollapsed(true);
      }, theme.transitions.duration.leavingScreen);

      return () => clearTimeout(drawerWidthTransitionTimeout);
    }

    setIsFullyCollapsed(false);

    return () => {};
  }, [expanded, theme.transitions.duration.leavingScreen]);

  const mini = !disableCollapsibleSidebar && !expanded;

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
  const isOperationsActive = ["/tasks/*", "/workflows/*", "/workers/*"].some(
    (pattern) => matchPath(pattern, pathname),
  );
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
      <Box
        component="nav"
        aria-label={`${viewport.charAt(0).toUpperCase()}${viewport.slice(1)}`}
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          ...(hasDrawerTransitions
            ? getDrawerSxTransitionMixin(isFullyExpanded, "padding")
            : {}),
        }}
      >
        <Toolbar />
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            scrollbarGutter: mini ? "stable" : "auto",
            overflowX: "hidden",
          }}
        >
          <List
            dense
            sx={{
              padding: mini ? 0 : "0px 8px",
              width: mini ? MINI_DRAWER_WIDTH : "auto",
              // Same top padding in both modes, so items stay at the same
              // vertical position when collapsing/expanding.
              pt: 1,
            }}
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
            <DashboardSidebarPageItem
              id="templates"
              title="Templates"
              icon={<LibraryBooksIcon />}
              href="/templates"
              selected={!!matchPath("/templates/*", pathname)}
              permissionKey="template"
              expanded={templatesExpanded}
              nestedNavigation={
                <Box sx={{ pl: 1.25 }}>
                  <DashboardSidebarPageItem
                    id="source_code_versions"
                    title="Template Versions"
                    icon={<HistoryIcon />}
                    href="/source_code_versions"
                    selected={!!matchPath("/source_code_versions/*", pathname)}
                    permissionKey="source_code_version"
                  />
                </Box>
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
                <Box sx={{ pl: 1.25 }}>
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
                </Box>
              }
            />

            <DashboardSidebarDividerItem />

            <DashboardSidebarPageItem
              id="operations"
              title="Operations"
              icon={<ConstructionIcon />}
              expanded={operationsExpanded}
              nestedNavigation={
                <Box sx={{ pl: 1.25 }}>
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
                </Box>
              }
            />

            <DashboardSidebarDividerItem />

            <DashboardSidebarPageItem
              id="management"
              title="Management"
              icon={<AdminPanelSettingsIcon />}
              expanded={managementExpanded}
              nestedNavigation={
                <Box sx={{ pl: 1.25 }}>
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
                    title="Audit Log"
                    icon={<ReceiptLongIcon />}
                    href="/audit_logs"
                    selected={!!matchPath("/audit_logs/*", pathname)}
                    permissionKey="audit_log"
                  />
                  <DashboardAdminSidebar />
                </Box>
              }
            />
          </List>
        </Box>
        {viewport === "desktop" && !disableCollapsibleSidebar ? (
          <DashboardSidebarToggleItem
            expanded={expanded}
            setExpanded={setExpanded}
          />
        ) : null}
      </Box>
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
      nestedExpanded,
    ],
  );

  const getDrawerSharedSx = React.useCallback(
    (isTemporary: boolean) => {
      const drawerWidth = mini ? MINI_DRAWER_WIDTH : DRAWER_WIDTH;

      return {
        displayPrint: "none",
        width: drawerWidth,
        flexShrink: 0,
        ...getDrawerWidthTransitionMixin(expanded),
        ...(isTemporary ? { position: "absolute" } : {}),
        [`& .MuiDrawer-paper`]: {
          position: "absolute",
          width: drawerWidth,
          boxSizing: "border-box",
          backgroundImage: "none",
          ...getDrawerWidthTransitionMixin(expanded),
        },
      };
    },
    [expanded, mini],
  );

  const sidebarContextValue = React.useMemo(() => {
    return {
      onPageItemClick: handlePageItemClick,
      mini,
      fullyExpanded: isFullyExpanded,
      fullyCollapsed: isFullyCollapsed,
      hasDrawerTransitions,
    };
  }, [
    handlePageItemClick,
    mini,
    isFullyExpanded,
    isFullyCollapsed,
    hasDrawerTransitions,
  ]);

  return (
    <DashboardSidebarContext.Provider value={sidebarContextValue}>
      <Drawer
        container={container}
        variant="temporary"
        open={expanded}
        onClose={handleSetSidebarExpanded(false)}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: {
            xs: "block",
            sm: disableCollapsibleSidebar ? "block" : "none",
            md: "none",
          },
          ...getDrawerSharedSx(true),
        }}
      >
        {getDrawerContent("phone")}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: {
            xs: "none",
            sm: disableCollapsibleSidebar ? "none" : "block",
            md: "none",
          },
          ...getDrawerSharedSx(false),
        }}
      >
        {getDrawerContent("tablet")}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          ...getDrawerSharedSx(false),
        }}
      >
        {getDrawerContent("desktop")}
      </Drawer>
    </DashboardSidebarContext.Provider>
  );
}
