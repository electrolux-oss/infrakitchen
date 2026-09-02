import React from "react";

import { Tooltip, Typography, TypographyProps } from "@mui/material";

import { GqlUserShort } from "../../users/graphql";
import { formatTimeAgo } from "../utils";

import { getDateValue } from "./CommonField";
import { UserAvatar } from "./UserAvatar";

interface RelativeTimeProps {
  date: string | Date;
  user?: GqlUserShort | null;
  component?: React.ElementType;
  variant?: TypographyProps["variant"];
  sx?: any;
}

export const RelativeTime: React.FC<RelativeTimeProps> = ({
  date,
  user,
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
    <Typography
      component={component}
      variant={variant}
      sx={{
        display: "inline-flex",
        // Top-align so the text sits at the same distance below the field
        // label even when an avatar makes the row taller (centering would
        // push the text down and vary the label-to-value gap per field).
        alignItems: "flex-start",
        gap: 1,
        ...sx,
      }}
    >
      {user && <UserAvatar id={user.id} identifier={user.identifier} />}
      <Tooltip title={exactTimestamp}>
        <Typography component="span" variant="inherit">
          {timeAgoText}
        </Typography>
      </Tooltip>
    </Typography>
  );
};
