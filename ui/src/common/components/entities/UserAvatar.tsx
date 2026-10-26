import React, { useCallback } from "react";

import { useNavigate } from "react-router";

import { Tooltip, Avatar, Link } from "../../../ui";
import { cn } from "../../../utils/cn";
import { useConfig } from "../../context";

// Extracts up to two initials from a user identifier by splitting on whitespace, underscores, hyphens, or dots, ignoring numeric-only segments.
// Strips Backstage entity ref prefix ([<kind>:][<namespace>/]) before extracting initials.
const getInitials = (identifier: string): string => {
  const name = identifier.replace(/^(?:[^:]*:)?(?:[^/]*\/)?/, "");
  return name
    .split(/[\s_\-.]+/)
    .filter((word) => !/^\d+$/.test(word))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
};

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
  className,
}: {
  id?: string;
  identifier?: string;
  className?: string;
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
        className={cn(
          "size-[1.5em] shrink-0 cursor-pointer text-[length:inherit]",
          className,
        )}
        style={{ backgroundColor: getAvatarColor(identifier) }}
      >
        <span className="text-[0.8em] font-normal">
          {getInitials(identifier)}
        </span>
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
