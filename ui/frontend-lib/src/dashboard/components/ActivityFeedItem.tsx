import React, { useCallback, useMemo } from "react";

import { useNavigate } from "react-router";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PendingIcon from "@mui/icons-material/Pending";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

import { GetEntityLink } from "../../common/components/CommonField";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { ActivityLogEntry } from "../types";

export interface ActivityFeedItemProps {
  activity: ActivityLogEntry;
  entityName?: string;
  entityStatus?: string;
}

export const ActivityFeedItem = ({
  activity,
  entityName,
  entityStatus,
}: ActivityFeedItemProps) => {
  const status = useMemo(() => {
    if (entityStatus) {
      if (["error"].includes(entityStatus)) return "failure";
      if (
        ["in_progress", "queued", "pending", "approval_pending"].includes(
          entityStatus,
        )
      )
        return "pending";
      if (["done", "ready", "enabled", "provisioned"].includes(entityStatus))
        return "success";
    }
    if (
      activity.action?.toLowerCase().includes("failure") ||
      activity.action?.toLowerCase().includes("error")
    ) {
      return "failure";
    }
    if (
      activity.action?.toLowerCase().includes("pending") ||
      activity.action?.toLowerCase().includes("in_progress")
    ) {
      return "pending";
    }
    return "success" as const;
  }, [activity.action, entityStatus]);

  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const href = `${linkPrefix}${activity.model}s/${activity.entityId}/audit`;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.button === 1) return;
      e.preventDefault();
      navigate(href);
    },
    [navigate, href],
  );

  const statusIconConfig = {
    success: { Icon: CheckCircleIcon, color: "success.main" },
    failure: { Icon: ErrorIcon, color: "error.main" },
    pending: { Icon: PendingIcon, color: "warning.main" },
  };
  const { Icon: StatusIcon, color: statusColor } = statusIconConfig[status];

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
        mb: 1,
      }}
    >
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
        >
          <Box flex={1} minWidth={0}>
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              flexWrap="wrap"
            >
              <Typography variant="body2" fontWeight={600}>
                {activity.action}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                ·
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: "capitalize" }}
              >
                {activity.model?.replace(/_/g, " ")}
              </Typography>
              {(entityName || activity.entityId) && (
                <>
                  <Typography variant="caption" color="text.disabled">
                    ·
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    <GetEntityLink
                      id={activity.entityId}
                      entityName={activity.model}
                      name={entityName ?? activity.entityId}
                    />
                  </Typography>
                </>
              )}
              {activity.creator && (
                <>
                  <Typography variant="caption" color="text.disabled">
                    ·
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    by{" "}
                    <span onClick={(e) => e.stopPropagation()}>
                      <GetEntityLink
                        id={activity.creator.id}
                        entityName="user"
                        name={
                          activity.creator.displayName ||
                          activity.creator.identifier
                        }
                      />
                    </span>
                  </Typography>
                </>
              )}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
            <Typography
              variant="caption"
              color="text.disabled"
              whiteSpace="nowrap"
            >
              <RelativeTime
                date={activity.createdAt}
                sx={{ fontSize: "0.75rem", display: "flex" }}
              />
            </Typography>
            <StatusIcon fontSize="small" sx={{ color: statusColor }} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
