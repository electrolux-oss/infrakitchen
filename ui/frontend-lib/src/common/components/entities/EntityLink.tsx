import React, { FC, useCallback } from "react";

import { useNavigate } from "react-router";

import { Box, Link } from "@mui/material";
import { SxProps, Theme } from "@mui/system";

import { useConfig } from "../../context";

interface EntityLinkProps {
  id: string;
  entityName?: string;
  name?: string;
  identifier?: string;
  sx?: SxProps<Theme>;
  /** Truncate the link text on a single line with an ellipsis (full text in a tooltip). */
  noWrap?: boolean;
}

/**
 * Renders a link to an entity's detail page (``${linkPrefix}${entityName}s/${id}``).
 * Used internally by Entity and CodeRepository — render those instead.
 */
export const EntityLink: FC<EntityLinkProps> = ({
  id,
  entityName,
  name,
  identifier,
  sx,
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

  const linkSx = noWrap
    ? ([{ flex: "1 1 0%", minWidth: 0 }, sx] as SxProps<Theme>)
    : sx;

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        ...(noWrap && {
          display: "flex",
          flexShrink: 1,
          minWidth: 0,
          overflow: "hidden",
        }),
      }}
    >
      <Link
        href={fullPath}
        onClick={handleClick}
        sx={linkSx}
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
    </Box>
  );
};
