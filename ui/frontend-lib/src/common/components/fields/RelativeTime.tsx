import React from "react";

import { Tooltip, Typography, TypographyProps } from "@mui/material";
import { formatTimeAgo } from "../../utils";
import { getDateValue } from "./CommonField";

interface RelativeTimeProps {
  date: string | Date;
  component?: React.ElementType;
  variant?: TypographyProps["variant"];
  sx?: any;
}

export const RelativeTime: React.FC<RelativeTimeProps> = ({
  date,
  component = "span",
  variant,
  sx,
}) => {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return (
      <Typography component={component} variant={variant} sx={sx}>
        {dateObj.toString()}
      </Typography>
    );
  }

  const timeAgoText = formatTimeAgo(date);
  const exactTimestamp = getDateValue(date);

  return (
    <Typography component={component} variant={variant} sx={sx}>
      <Tooltip title={exactTimestamp}>
        <Typography component="span" variant="inherit">
          {timeAgoText}
        </Typography>
      </Tooltip>
    </Typography>
  );
};
