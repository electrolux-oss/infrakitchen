import React, { useCallback } from "react";

import { useNavigate } from "react-router";

import { Card, CardContent, Stack, Typography } from "@mui/material";

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
    <Card
      component="a"
      href={href}
      onClick={handleClick}
      sx={{
        cursor: "pointer",
        textDecoration: "none",
        display: "block",
        "&:hover": {
          borderColor: "text.disabled",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        },
        transition: "all 0.1s ease-in-out",
      }}
    >
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography
            variant="body2"
            fontWeight={600}
            title={resource.name}
            sx={{ flex: 1, minWidth: 0 }}
          >
            {resource.name}
          </Typography>
          {resource.updatedAt && (
            <Typography
              variant="caption"
              color="text.disabled"
              whiteSpace="nowrap"
            >
              <RelativeTime
                date={resource.updatedAt}
                sx={{ fontSize: "0.75rem", display: "flex" }}
              />
            </Typography>
          )}
          {(resource.status || resource.state) && (
            <StatusChip
              status={resource.status ?? ""}
              state={resource.state}
              compact
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
