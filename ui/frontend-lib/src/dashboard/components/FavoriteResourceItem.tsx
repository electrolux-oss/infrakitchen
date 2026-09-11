import React, { useCallback } from "react";

import { useNavigate } from "react-router";

import { Box, Typography } from "@mui/material";

import { useConfig } from "../../common";
import { Entity } from "../../common/components/entities/Entity";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
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
      // The entity name renders as its own link (via the shared Entity
      // component) — let it handle navigation instead of double-navigating.
      if ((e.target as Element).closest("a")) return;
      e.preventDefault();
      navigate(href);
    },
    [navigate, href],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate(href);
      }
    },
    [navigate, href],
  );

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.25,
        cursor: "pointer",
        borderBottom: "1px solid",
        borderColor: "divider",
        transition: "background-color 120ms ease-in-out",
        outline: "none",
        "&:hover": {
          backgroundColor: "action.hover",
        },
        "&:focus-visible": {
          boxShadow: "0 0 0 2px",
        },
        "&:last-child": {
          borderBottom: "none",
        },
      }}
    >
      <Box
        title={resource.name}
        sx={{ flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap" }}
      >
        <Entity
          entity={{
            id: resource.id,
            name: resource.name,
            entityType: resource.entityName ?? resource._component_type,
            template: resource.template,
          }}
          showLabel
        />
      </Box>
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
