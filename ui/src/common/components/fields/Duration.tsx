import React from "react";

import { Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";

interface DurationProps {
  start: string | Date;
  end: string | Date;
  /** Defaults to body2 in the muted text color. */
  className?: string;
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
  className,
}) => {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return (
      <span className={cn("text-body2 text-fg-muted", className)}>
        Invalid date
      </span>
    );
  }

  const durationText = formatDuration(start, end);
  const detailedDuration = formatDetailedDuration(start, end);

  return (
    <Tooltip title={detailedDuration}>
      <span
        className={cn(
          "inline-flex cursor-pointer items-center text-body2 text-fg-muted underline decoration-fg-muted decoration-dashed underline-offset-[5px]",
          className,
        )}
      >
        {durationText}
      </span>
    </Tooltip>
  );
};
