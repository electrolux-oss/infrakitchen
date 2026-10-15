import { useState } from "react";

import { Avatar, ClickAwayListener } from "../../../ui";
import { cn } from "../../../utils/cn";

import { UserAvatar } from "./UserAvatar";

/** Default number of avatars rendered before collapsing into a "+N" toggle. */
const DEFAULT_MAX_AVATARS = 3;

export interface UserAvatarListProps {
  /** Users to show as clickable avatar circles. Nullish entries are skipped. */
  users?: Array<{
    id?: string | null;
    identifier?: string | null;
  } | null> | null;
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
  const list = (users ?? [])
    .filter(
      (user): user is { id?: string | null; identifier?: string | null } =>
        Boolean(user),
    )
    .sort((a, b) => (a.identifier ?? "").localeCompare(b.identifier ?? ""));
  if (list.length === 0) {
    return null;
  }
  const overflow = list.slice(max);
  const overflowCount = overflow.length;
  // Match the "99+" convention: show the exact count until it would exceed 99.
  const overflowLabel = overflowCount > 99 ? "99+" : `+${overflowCount}`;

  return (
    <ClickAwayListener onClickAway={() => setExpanded(false)}>
      <div className="flex flex-wrap gap-1">
        {list.slice(0, max).map((user) => (
          <UserAvatar
            key={user.id ?? user.identifier}
            id={user.id ?? undefined}
            identifier={user.identifier ?? undefined}
          />
        ))}
        {expanded &&
          overflow.map((user, index) => (
            <span
              key={user.id ?? user.identifier}
              className="inline-flex transition-[opacity,scale] duration-[180ms] ease-out starting:scale-75 starting:opacity-0"
              style={{ transitionDelay: `${Math.min(index, 6) * 40}ms` }}
            >
              <UserAvatar
                id={user.id ?? undefined}
                identifier={user.identifier ?? undefined}
              />
            </span>
          ))}
        {!expanded && overflowCount > 0 && (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-inherit outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/35"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            aria-label={`Show all ${list.length} users`}
          >
            <Avatar
              className={cn(
                "text-[length:inherit]",
                "h-[1.5em] w-auto min-w-[1.5em]",
                overflowLabel.length > 3 ? "px-1" : "px-0",
                "box-border rounded-full bg-grey-400",
              )}
            >
              <span
                className={cn(
                  "text-body2",
                  overflowLabel.length > 5 ? "text-[0.6em]" : "text-[0.8em]",
                  "whitespace-nowrap",
                )}
              >
                {overflowLabel}
              </span>
            </Avatar>
          </button>
        )}
      </div>
    </ClickAwayListener>
  );
};
