import React, { useCallback } from "react";

import { useNavigate } from "react-router";

import { Box, Typography } from "@mui/material";

import { useConfig } from "../../common";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { FavoriteResource } from "../types";

export interface FavoriteResourceItemProps {
  resource: FavoriteResource;
}

export const FavoriteResourceItem = ({
  resource,
}: FavoriteResourceItemProps) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const href =
    resource._component_type === "executor"
      ? `${linkPrefix}executors/${resource.id}`
      : `${linkPrefix}resources/${resource.id}`;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.button === 1) return;
      e.preventDefault();
      navigate(href);
    },
    [navigate, href],
  );

  return (
    <Box
      component="a"
      href={href}
      onClick={handleClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.25,
        textDecoration: "none",
        color: "inherit",
        borderBottom: "1px solid",
        borderColor: "divider",
        cursor: "pointer",
        transition: "background-color 120ms ease-in-out",
        "&:hover": {
          backgroundColor: "action.hover",
        },
        "&:last-child": {
          borderBottom: "none",
        },
      }}
    >
      <Typography
        title={resource.name}
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {resource.name}
      </Typography>
      {resource.updatedAt && (
        <Typography color="text.disabled" sx={{ whiteSpace: "nowrap" }}>
          <RelativeTime date={resource.updatedAt} sx={{ display: "flex" }} />
        </Typography>
      )}
      {(resource.status || resource.state) && (
        <StatusChip
          status={resource.status ?? ""}
          state={resource.state}
          compact
        />
      )}
    </Box>
  );
};
