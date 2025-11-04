import * as React from "react";

import { matchPath, useLocation } from "react-router";

import { Icon } from "@iconify/react";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import CodeIcon from "@mui/icons-material/Code";
import HistoryIcon from "@mui/icons-material/History";
import HubIcon from "@mui/icons-material/Hub";
import ListAltIcon from "@mui/icons-material/ListAlt";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import PeopleIcon from "@mui/icons-material/People";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import StorageIcon from "@mui/icons-material/Storage";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import { Avatar, Stack, Typography } from "@mui/material";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import { useTheme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import useMediaQuery from "@mui/material/useMediaQuery";

import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from "../../constants";
import DashboardSidebarContext from "../../context/DashboardSidebarContext";
import { useAuth } from "../auth/AuthContext";

import DashboardSidebarDividerItem from "./DashboardSidebarDividerItem";
import DashboardSidebarHeaderItem from "./DashboardSidebarHeaderItem";
import DashboardSidebarPageItem from "./DashboardSidebarPageItem";
import {
  getDrawerSxTransitionMixin,
  getDrawerWidthTransitionMixin,
} from "./mixins";
import OptionsMenu from "./UserSidebar";

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
  const { user } = useAuth();

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

  const handlePageItemClick = React.useCallback(
    (itemId: string, hasNestedNavigation: boolean) => {
      if (!isOverSmViewport && !hasNestedNavigation) {
        setExpanded(false);
      }
    },
    [setExpanded, isOverSmViewport],
  );

  const hasDrawerTransitions =
    isOverSmViewport && (!disableCollapsibleSidebar || isOverMdViewport);

  const getDrawerContent = React.useCallback(
    (viewport: "phone" | "tablet" | "desktop") => (
      <Box
        component="nav"
        aria-label={`${viewport.charAt(0).toUpperCase()}${viewport.slice(1)}`}
        sx={{
          height: "100%",
          overflow: "auto",
          scrollbarGutter: mini ? "stable" : "auto",
          overflowX: "hidden",
          ...(hasDrawerTransitions
            ? getDrawerSxTransitionMixin(isFullyExpanded, "padding")
            : {}),
        }}
      >
        <Toolbar />
        <List
          dense
          sx={{
            padding: mini ? 0 : 0.5,
            mb: 4,
            width: mini ? MINI_DRAWER_WIDTH : "auto",
            pt: !mini ? 0 : 2,
          }}
        >
          <DashboardSidebarHeaderItem></DashboardSidebarHeaderItem>
          <DashboardSidebarPageItem
            id="getting-started"
            title="Getting Started"
            icon={<Icon icon="emojione:shopping-cart" width="20" height="20" />}
            href="/getting-started"
            selected={
              !!matchPath("/getting-started/*", pathname) || pathname === "/"
            }
          />
          <DashboardSidebarPageItem
            id="integrations"
            title="Integrations"
            icon={<Icon icon="noto:fork-and-knife" width="20" height="20" />}
            href="/integrations"
            selected={!!matchPath("/integrations/*", pathname)}
          />
          <DashboardSidebarPageItem
            id="templates"
            title="Templates"
            icon={<Icon icon="noto:canned-food" width="20" height="20" />}
            href="/templates"
            selected={!!matchPath("/templates/*", pathname)}
          />
          <DashboardSidebarPageItem
            id="resources"
            title="Resources"
            icon={
              <Icon icon="emojione:delivery-truck" width="22" height="24" />
            }
            href="/resources"
            selected={!!matchPath("/resources/*", pathname)}
          />

          <DashboardSidebarDividerItem />
          <DashboardSidebarHeaderItem>Advanced</DashboardSidebarHeaderItem>

          <DashboardSidebarPageItem
            id="source_codes"
            title="Code Repositories"
            icon={<CodeIcon />}
            href="/source_codes"
            selected={!!matchPath("/source_codes/*", pathname)}
          />
          <DashboardSidebarPageItem
            id="source_code_versions"
            title="Code Versions"
            icon={<HistoryIcon />}
            href="/source_code_versions"
            selected={!!matchPath("/source_code_versions/*", pathname)}
          />
          <DashboardSidebarPageItem
            id="workspaces"
            title="Workspaces"
            icon={<WorkspacesIcon />}
            href="/workspaces"
            selected={!!matchPath("/workspaces/*", pathname)}
          />
          <DashboardSidebarPageItem
            id="tasks"
            title="Tasks"
            icon={<PlaylistAddCheckIcon />}
            href="/tasks"
            selected={!!matchPath("/tasks/*", pathname)}
          />
          <DashboardSidebarPageItem
            id="storages"
            title="Storage"
            icon={<StorageIcon />}
            href="/storages"
            selected={!!matchPath("/storages/*", pathname)}
          />

          <DashboardSidebarDividerItem />
          <DashboardSidebarHeaderItem>
            Administration
          </DashboardSidebarHeaderItem>
          <DashboardSidebarPageItem
            id="users"
            title="Users"
            icon={<PeopleIcon />}
            href="/users"
            selected={!!matchPath("/users/*", pathname)}
          />
          <DashboardSidebarPageItem
            id="roles"
            title="Roles"
            icon={<AccountCircleIcon />}
            href="/roles"
            selected={!!matchPath("/roles/*", pathname)}
          />
          <DashboardSidebarPageItem
            id="audit_logs"
            title="Audit Log"
            icon={<ListAltIcon />}
            href="/audit_logs"
            selected={!!matchPath("/audit_logs/*", pathname)}
          />
          <DashboardSidebarPageItem
            id="auth_providers"
            title="Auth Providers"
            icon={<VerifiedUserIcon />}
            href="/auth_providers"
            selected={!!matchPath("/auth_providers/*", pathname)}
          />
          <DashboardSidebarPageItem
            id="admin"
            title="Settings"
            icon={<MiscellaneousServicesIcon />}
            href="/admin"
            selected={!!matchPath("/admin/*", pathname)}
          />
          <DashboardSidebarPageItem
            id="workers"
            title="Workers"
            icon={<HubIcon />}
            href="/workers"
            selected={!!matchPath("/workers/*", pathname)}
          />

          {user && (
            <Stack
              direction="row"
              sx={{
                p: 2,
                gap: 1,
                alignItems: "center",
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Avatar
                sx={{
                  fontSize: 10,
                  height: 16,
                  width: 16,
                  flexShrink: 0,
                }}
              >
                {user.identifier
                  .split(/[\s_-]+/)
                  .slice(0, 2)
                  .map((words) => words.charAt(0).toUpperCase())
                  .join("")}
              </Avatar>
              <Box
                sx={{
                  mr: "auto",
                  minWidth: 0,
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    lineHeight: "16px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.identifier}
                </Typography>
                {user.email && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                    }}
                  >
                    {user.email}
                  </Typography>
                )}
              </Box>
              <OptionsMenu />
            </Stack>
          )}
        </List>
      </Box>
    ),
    [mini, hasDrawerTransitions, isFullyExpanded, pathname, user],
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
