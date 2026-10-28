import React, { FC, useCallback } from "react";

import { useNavigate } from "react-router";

import { Link } from "../../../ui";
import { cn } from "../../../utils/cn";
import { useConfig } from "../../context";

interface EntityLinkProps {
  id: string;
  entityName?: string;
  name?: string;
  identifier?: string;
  className?: string;
  /** Truncate the link text on a single line with an ellipsis (full text in a tooltip). */
  noWrap?: boolean;
}

/**
 * Renders a link to an entity's detail page.
 * Used internally by Entity and CodeRepository — render those instead.
 */
export const EntityLink: FC<EntityLinkProps> = ({
  id,
  entityName,
  name,
  identifier,
  className,
  noWrap = false,
}) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const fullPath = `${linkPrefix}${entityName}s/${id}`;
  const displayText = name || identifier;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Allow default behavior for Cmd/Ctrl+Click (opens in new tab)
      if (e.metaKey || e.ctrlKey) {
        return;
      }

      e.preventDefault();
      navigate(fullPath);
    },
    [navigate, fullPath],
  );

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2",
        noWrap && "flex min-w-0 shrink overflow-hidden",
      )}
    >
      <Link
        className={cn(noWrap && "min-w-0 flex-1", className)}
        href={fullPath}
        onClick={handleClick}
        title={noWrap ? displayText : undefined}
        style={{
          cursor: "pointer",
          ...(noWrap
            ? {
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }
            : { whiteSpace: "normal" }),
        }}
      >
        {displayText}
      </Link>
    </div>
  );
};
