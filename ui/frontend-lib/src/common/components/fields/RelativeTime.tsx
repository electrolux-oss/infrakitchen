import React from "react";

import { Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";
import { formatTimeAgo } from "../../utils";

import { getDateValue } from "./CommonField";

interface RelativeTimeProps {
  date: string | Date;
  /** Dense table cells show "1h ago" instead of "1 hour ago". */
  compact?: boolean;
  /** Defaults to body2; pass e.g. text-caption to change the size. */
  className?: string;
}

export const RelativeTime: React.FC<RelativeTimeProps> = ({
  date,
  compact = false,
  className,
}) => {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return (
      <span className={cn("text-body2", className)}>{dateObj.toString()}</span>
    );
  }

  const timeAgoText = formatTimeAgo(date, compact);
  const exactTimestamp = getDateValue(date);

  return (
    <span className={cn("text-body2", className)}>
      <Tooltip title={exactTimestamp}>
        <span>{timeAgoText}</span>
      </Tooltip>
    </span>
  );
};
