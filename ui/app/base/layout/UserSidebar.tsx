import * as React from "react";

import { useNavigate } from "react-router";

import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider, { dividerClasses } from "@mui/material/Divider";
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

// Build the initials avatar from the user identifier.
const getInitials = (identifier: string) =>
  identifier
    .split(/[\s_-]+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

export default function UserSidebar() {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const navigate = useNavigate();

  const { user, logout } = useAuth();

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
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
      <MenuButton
        aria-label="Open user menu"
        onClick={handleOpen}
        aria-controls={open ? "user-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="true"
        sx={(theme) => ({
          p: 0,
          border: "none",
          backgroundColor: "transparent",
          "&:hover": { backgroundColor: "transparent" },
          height: "2.25rem",
          ...theme.applyStyles("dark", {
            border: "none",
            backgroundColor: "transparent",
            "&:hover": { backgroundColor: "transparent" },
          }),
        })}
      >
        <Avatar
          sx={{
            fontSize: 11,
            height: 30,
            width: 30,
            flexShrink: 0,
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: "action.selected",
          }}
        >
          {getInitials(user.identifier)}
        </Avatar>
      </MenuButton>
      <Menu
        anchorEl={anchorEl}
        id="user-menu"
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
            minWidth: 240,
          },
          [`& .${dividerClasses.root}`]: {
            margin: "4px 0",
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ px: 2, py: 1.5, alignItems: "center" }}
        >
          <Avatar
            sx={{
              fontSize: 15,
              height: 40,
              width: 40,
              bgcolor: "action.selected",
            }}
          >
            {getInitials(user.identifier)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 600,
                lineHeight: 1.3,
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
        </Stack>

        <Divider />

        <MenuItem
          onClick={() => navigate(`/users/${user.id}`)}
          sx={{
            [`& .${listItemIconClasses.root}`]: {
              minWidth: 0,
              mr: 1.5,
            },
          }}
        >
          <ListItemIcon>
            <PersonRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>My profile</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={logout}
          sx={{
            [`& .${listItemIconClasses.root}`]: {
              minWidth: 0,
              mr: 1.5,
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
