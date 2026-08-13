import * as React from "react";

import { Link } from "react-router";

import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import { dividerClasses } from "@mui/material/Divider";
import { listClasses } from "@mui/material/List";
import ListItemIcon, { listItemIconClasses } from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MuiMenuItem from "@mui/material/MenuItem";
import { paperClasses } from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

import { useAuth } from "../auth/AuthContext";

import MenuButton from "./MenuButton";

const MenuItem = styled(MuiMenuItem)({
  margin: "2px 0",
});

export default function UserSidebar() {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const { user, logout } = useAuth();
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  if (!user) {
    return null;
  }

  return (
    <Stack
      direction="row"
      sx={{
        gap: 1,
        alignItems: "center",
        minWidth: 0,
      }}
    >
      <Avatar
        sx={{
          fontSize: 10,
          height: 24,
          width: 24,
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
        component={Link}
        to={`/users/${user.id}`}
        sx={{
          minWidth: 0,
          textDecoration: "none",
          color: "inherit",
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
        {user.email ? (
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
        ) : null}
      </Box>
      <MenuButton
        aria-label="Open user menu"
        onClick={handleClick}
        sx={{ borderColor: "transparent", flexShrink: 0 }}
      >
        <MoreVertRoundedIcon />
      </MenuButton>
      <Menu
        anchorEl={anchorEl}
        id="menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        sx={{
          [`& .${listClasses.root}`]: {
            padding: "4px",
          },
          [`& .${paperClasses.root}`]: {
            padding: 0,
          },
          [`& .${dividerClasses.root}`]: {
            margin: "4px -4px",
          },
        }}
      >
        <MenuItem
          onClick={logout}
          sx={{
            [`& .${listItemIconClasses.root}`]: {
              ml: "auto",
              minWidth: 0,
              mr: 1,
            },
          }}
        >
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Log Out</ListItemText>
        </MenuItem>
      </Menu>
    </Stack>
  );
}
