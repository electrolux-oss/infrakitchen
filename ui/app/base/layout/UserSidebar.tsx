import * as React from "react";

import { useNavigate } from "react-router";

import {
  Divider,
  ListItemIcon,
  ListItemText,
  LogoutRoundedIcon,
  Menu,
  MenuItem,
  PersonRoundedIcon,
  UserAvatar,
} from "@electrolux-oss/infrakitchen";

import { useAuth } from "../auth/AuthContext";

import MenuButton from "./MenuButton";

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
    <div className="flex min-w-0 flex-row items-center gap-2">
      <MenuButton
        aria-label="Open user menu"
        onClick={handleOpen}
        aria-controls={open ? "user-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="true"
        className="h-9 border-0 bg-transparent p-0 hover:bg-transparent"
      >
        <UserAvatar
          identifier={user.identifier}
          className="border border-divider text-[0.875rem]"
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
        className="min-w-50 p-0"
        listClassName="p-0.5"
      >
        <div className="flex flex-row items-center gap-2 px-3 py-2">
          <UserAvatar
            identifier={user.identifier}
            className="size-[30px] text-[14px]"
          />
          <div className="min-w-0">
            <p className="m-0 truncate text-body2 leading-[1.3]">
              {user.identifier}
            </p>
            {user.email ? (
              <span className="block truncate text-caption text-fg-muted">
                {user.email}
              </span>
            ) : null}
          </div>
        </div>

        <Divider className="my-0.5" />

        <MenuItem
          className="my-0.5 py-1"
          onClick={() => navigate(`/users/${user.id}`)}
        >
          <ListItemIcon className="mr-3">
            <PersonRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryClassName="font-normal">My Profile</ListItemText>
        </MenuItem>

        <MenuItem className="my-0.5 py-1" onClick={logout}>
          <ListItemIcon className="mr-3">
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryClassName="font-normal">Log Out</ListItemText>
        </MenuItem>
      </Menu>
    </div>
  );
}
