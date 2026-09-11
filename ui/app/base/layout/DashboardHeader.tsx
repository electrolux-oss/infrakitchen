import * as React from "react";

import { Link } from "react-router";

import {
  CODE_FONT_FAMILY,
  Label,
  ServerInfoDialog,
  useConfig,
} from "@electrolux-oss/infrakitchen";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MuiAppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import ThemeSwitcher from "./ThemeSwitcher";
import UserSidebar from "./UserSidebar";

const AppBar = styled(MuiAppBar)(({ theme }) => ({
  borderWidth: 0,
  borderBottomWidth: 1,
  borderStyle: "solid",
  borderColor: (theme.vars ?? theme).palette.divider,
  // Header shares the grey canvas color with the sidebar and content.
  backgroundColor: (theme.vars ?? theme).palette.background.default,
  boxShadow: "none",
  zIndex: theme.zIndex.drawer + 1,
}));

const LogoContainer = styled("div")({
  position: "relative",
  display: "flex",
  alignItems: "center",
  "& svg": { width: 32, height: 32, marginLeft: 10 },
});

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
              size="small"
              aria-label={`${isExpanded ? collapseMenuActionText : expandMenuActionText} navigation menu`}
              onClick={handleMenuOpen}
              sx={(theme) => ({
                border: "none",
                backgroundColor: "transparent",
                "&:hover": { backgroundColor: "transparent" },
                ...theme.applyStyles("dark", {
                  border: "none",
                  backgroundColor: "transparent",
                  "&:hover": { backgroundColor: "transparent" },
                }),
              })}
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
    <AppBar color="inherit" position="absolute" sx={{ displayPrint: "none" }}>
      <Toolbar sx={{ backgroundColor: "inherit", mx: { xs: -0.75, sm: -1 } }}>
        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            width: "100%",
          }}
        >
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
            }}
          >
            <Box sx={{ mr: 1, display: { xs: "block", md: "none" } }}>
              {getMenuIcon(menuOpen)}
            </Box>
            <Link to="/" style={{ textDecoration: "none" }}>
              {logo ? <LogoContainer>{logo}</LogoContainer> : null}
            </Link>
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
              }}
            >
              {title ? (
                <Link to="/" style={{ textDecoration: "none" }}>
                  <Typography
                    variant="h5"
                    sx={{
                      color: "text.primary",
                      fontWeight: 600,
                      fontSize: "1.875rem", // 30px
                      letterSpacing: "-0.02em",
                      ml: 0,
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                    }}
                  >
                    {title}
                  </Typography>
                </Link>
              ) : null}
              {serverInfo ? (
                <Label
                  component="button"
                  onClick={handleServerInfoOpen}
                  label={
                    <Box
                      component="span"
                      sx={{ fontFamily: CODE_FONT_FAMILY }}
                    >{`v${String(serverInfo.version).replace(
                      /^v/,
                      "",
                    )}-${serverInfo.sourceCommitShort}`}</Box>
                  }
                  sx={{
                    alignSelf: "flex-end",
                    ml: 2,
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: "action.selected",
                    },
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: "1px",
                    },
                  }}
                />
              ) : null}
            </Stack>
          </Stack>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              marginLeft: "auto",
              minWidth: 0,
            }}
          >
            <Stack
              direction="row"
              spacing={0.5}
              sx={{
                alignItems: "center",
              }}
            >
              <ThemeSwitcher />
            </Stack>
            <UserSidebar />
          </Stack>
        </Stack>
        <ServerInfoDialog
          open={serverInfoOpen}
          onClose={handleServerInfoClose}
        />
      </Toolbar>
    </AppBar>
  );
}
