import * as React from "react";

import { useNavigate } from "react-router";

import { UserAvatar } from "@electrolux-oss/infrakitchen";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
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
import Typography, { typographyClasses } from "@mui/material/Typography";

import { useAuth } from "../auth/AuthContext";

import MenuButton from "./MenuButton";

const MenuItem = styled(MuiMenuItem)({
  margin: "2px 0",
  paddingTop: 4,
  paddingBottom: 4,
});

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
        <UserAvatar
          identifier={user.identifier}
          sx={{
            fontSize: 14,
            height: 30,
            width: 30,
            flexShrink: 0,
            border: "1px solid",
            borderColor: "divider",
          }}
        />
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
            padding: "2px",
          },
          [`& .${paperClasses.root}`]: {
            padding: 0,
            minWidth: 200,
          },
          [`& .${dividerClasses.root}`]: {
            margin: "2px 0",
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ px: 1.5, py: 1, alignItems: "center" }}
        >
          <UserAvatar
            identifier={user.identifier}
            sx={{
              fontSize: 14,
              height: 30,
              width: 30,
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
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
          <ListItemText
            sx={{
              [`& .${typographyClasses.root}`]: {
                fontWeight: 400,
              },
            }}
          >
            My Profile
          </ListItemText>
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
          <ListItemText
            sx={{
              [`& .${typographyClasses.root}`]: {
                fontWeight: 400,
              },
            }}
          >
            Log Out
          </ListItemText>
        </MenuItem>
      </Menu>
    </Stack>
  );
}
