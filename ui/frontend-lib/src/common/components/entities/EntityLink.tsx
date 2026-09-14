import React, { FC, useCallback } from "react";

import { useNavigate } from "react-router";

import { Box, Link } from "@mui/material";
import { SxProps, Theme } from "@mui/system";

import { useConfig } from "../../context";

interface EntityLinkProps {
  id: string;
  entityName?: string;
  urlProvider?: string;
  name?: string;
  identifier?: string;
  sx?: SxProps<Theme>;
  className?: string;
  /** Truncate the link text on a single line with an ellipsis (full text in a tooltip). */
  noWrap?: boolean;
}

/**
 * Renders a link to an entity's detail page, including an optional provider
 * route segment for entities such as integrations.
 * Used internally by Entity and CodeRepository — render those instead.
 */
export const EntityLink: FC<EntityLinkProps> = ({
  id,
  entityName,
  urlProvider,
  name,
  identifier,
  sx,
  className,
  noWrap = false,
}) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const basePath = `${linkPrefix}${entityName}s`;
  const fullPath = urlProvider
    ? `${basePath}/${urlProvider}/${id}`
    : `${basePath}/${id}`;
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
        className={className}
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
