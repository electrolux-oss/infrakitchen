import React from "react";

import { Tooltip, Typography, TypographyProps } from "@mui/material";

interface DurationProps {
  start: string | Date;
  end: string | Date;
  component?: React.ElementType;
  variant?: TypographyProps["variant"];
  sx?: any;
}

function formatDuration(start: string | Date, end: string | Date): string {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);

  const ms = endDate.getTime() - startDate.getTime();
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSecs}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatDetailedDuration(
  start: string | Date,
  end: string | Date,
): string {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);

  return `${startDate.toLocaleString()} → ${endDate.toLocaleString()}`;
}

export const Duration: React.FC<DurationProps> = ({
  start,
  end,
  component = "span",
  variant,
  sx,
}) => {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return (
      <Typography
        component={component}
        variant={variant}
        sx={sx || { color: "text.secondary" }}
      >
        Invalid date
      </Typography>
    );
  }

  const durationText = formatDuration(start, end);
  const detailedDuration = formatDetailedDuration(start, end);

  return (
    <Tooltip title={detailedDuration}>
      <Typography
        component={component}
        variant={variant}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          cursor: "pointer",
          textDecoration: "underline dashed",
          textDecorationColor: "text.secondary",
          textUnderlineOffset: "5px",
          ...(sx || { color: "text.secondary" }),
        }}
      >
        {durationText}
      </Typography>
    </Tooltip>
  );
};
