import React, { useCallback } from "react";

import { useNavigate } from "react-router";

import { Avatar, Link, Tooltip, Typography } from "@mui/material";

import { useConfig } from "../context";

const getInitials = (identifier: string): string =>
  identifier
    .split(/[\s_-]+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

// Derives a deterministic background color from the user identifier using a hash-to-HSL mapping.
const getAvatarColor = (identifier: string): string => {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
};

export const UserAvatar = ({
  id,
  identifier,
  sx,
}: {
  id?: string;
  identifier?: string;
  sx?: any;
}) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const fullPath = id ? `${linkPrefix}users/${id}` : undefined;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      if (fullPath) navigate(fullPath);
    },
    [navigate, fullPath],
  );

  if (!identifier) return null;

  const avatar = (
    <Tooltip title={identifier}>
      <Avatar
        sx={{
          fontSize: "inherit",
          height: "1.5em",
          width: "1.5em",
          flexShrink: 0,
          cursor: "pointer",
          bgcolor: getAvatarColor(identifier),
          ...sx,
        }}
      >
        <Typography component="span" sx={{ fontSize: "0.8em" }}>
          {getInitials(identifier)}
        </Typography>
      </Avatar>
    </Tooltip>
  );

  if (!fullPath) return avatar;

  return (
    <Link
      href={fullPath}
      onClick={handleClick}
      style={{ textDecoration: "none", lineHeight: 0 }}
    >
      {avatar}
    </Link>
  );
};
