import * as React from "react";

import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import Box from "@mui/material/Box";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";

import DashboardSidebarContext from "../../context/DashboardSidebarContext";

export interface DashboardSidebarToggleItemProps {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

export default function DashboardSidebarToggleItem({
  expanded,
  setExpanded,
}: DashboardSidebarToggleItemProps) {
  const sidebarContext = React.useContext(DashboardSidebarContext);
  if (!sidebarContext) {
    throw new Error("Sidebar context was used without a provider.");
  }
  const { mini = false } = sidebarContext;

  const handleClick = React.useCallback(() => {
    setExpanded(!expanded);
  }, [expanded, setExpanded]);

  const icon = expanded ? <MenuOpenIcon /> : <MenuIcon />;

  return (
    <Tooltip
      title={mini ? (expanded ? "Collapse" : "Expand") : ""}
      placement="right"
      enterDelay={500}
    >
      <ListItem
        disablePadding
        sx={{
          display: "block",
          py: 0,
          px: 1,
          overflowX: "hidden",
        }}
      >
        <ListItemButton
          onClick={handleClick}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          sx={{
            height: mini ? 34 : "auto",
          }}
        >
          {mini ? (
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <ListItemIcon
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {icon}
              </ListItemIcon>
            </Box>
          ) : (
            <React.Fragment>
              <ListItemIcon
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "auto",
                }}
              >
                {icon}
              </ListItemIcon>
              <ListItemText
                primary={expanded ? "Collapse" : "Expand"}
                sx={{
                  whiteSpace: "nowrap",
                  zIndex: 1,
                }}
              />
            </React.Fragment>
          )}
        </ListItemButton>
      </ListItem>
    </Tooltip>
  );
}
