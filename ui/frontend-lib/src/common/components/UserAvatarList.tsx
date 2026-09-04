import { useState } from "react";

import {
  Avatar,
  Box,
  ButtonBase,
  ClickAwayListener,
  Grow,
  Typography,
} from "@mui/material";

import { UserAvatar } from "./UserAvatar";

/** Default number of avatars rendered before collapsing into a "+N" toggle. */
const DEFAULT_MAX_AVATARS = 3;

export interface UserAvatarListProps {
  /** Users to show as clickable avatar circles. */
  users: Array<{ id?: string | null; identifier?: string | null }>;
  /**
   * Maximum number of avatars rendered before collapsing the rest behind a
   * "+N" toggle. Pass `Infinity` to always render every user.
   */
  max?: number;
}

/**
 * A wrapping row of user avatars that link to each user's page.
 * Users are sorted by identifier; longer lists collapse behind a "+N" button
 * that expands to show every user until a click elsewhere collapses it again.
 */
export const UserAvatarList = ({
  users,
  max = DEFAULT_MAX_AVATARS,
}: UserAvatarListProps) => {
  const [expanded, setExpanded] = useState(false);
  const list = [...users].sort((a, b) =>
    (a.identifier ?? "").localeCompare(b.identifier ?? ""),
  );
  const overflow = list.slice(max);
  const overflowCount = overflow.length;
  // Match the "99+" convention: show the exact count until it would exceed 99.
  const overflowLabel = overflowCount > 99 ? "99+" : `+${overflowCount}`;

  return (
    <ClickAwayListener onClickAway={() => setExpanded(false)}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {list.slice(0, max).map((user) => (
          <UserAvatar
            key={user.id ?? user.identifier}
            id={user.id ?? undefined}
            identifier={user.identifier ?? undefined}
          />
        ))}
        {expanded &&
          overflow.map((user, index) => (
            <Grow
              key={user.id ?? user.identifier}
              in
              appear
              timeout={180}
              style={{ transitionDelay: `${Math.min(index, 6) * 40}ms` }}
            >
              <Box component="span" sx={{ display: "inline-flex" }}>
                <UserAvatar
                  id={user.id ?? undefined}
                  identifier={user.identifier ?? undefined}
                />
              </Box>
            </Grow>
          ))}
        {!expanded && overflowCount > 0 && (
          <ButtonBase
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            aria-label={`Show all ${list.length} users`}
            sx={{ borderRadius: "999px" }}
          >
            <Avatar
              sx={{
                fontSize: "inherit",
                height: "1.5em",
                minWidth: "1.5em",
                width: "auto",
                paddingX: overflowLabel.length > 3 ? 0.5 : 0,
                boxSizing: "border-box",
                borderRadius: "999px",
                bgcolor: "grey.400",
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontSize: overflowLabel.length > 5 ? "0.6em" : "0.8em",
                  whiteSpace: "nowrap",
                }}
              >
                {overflowLabel}
              </Typography>
            </Avatar>
          </ButtonBase>
        )}
      </Box>
    </ClickAwayListener>
  );
};
