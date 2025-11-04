import React from "react";

import { Tooltip, Typography, TypographyProps } from "@mui/material";

import { UserShort } from "../../users/types";
import { formatTimeAgo } from "../utils";

import { getDateValue, GetReferenceUrlValue } from "./CommonField";

interface RelativeTimeProps {
  date: string | Date;
  user?: UserShort | null;
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
      <Typography
        component={component}
        variant={variant}
        sx={sx || { color: "text.secondary" }}
      >
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
      sx={sx || { color: "text.secondary" }}
    >
      <Tooltip title={exactTimestamp}>
        <Typography
          component="span"
          variant="inherit"
          sx={{
            cursor: "pointer",
            textDecoration: "underline dashed",
            textDecorationColor: "text.secondary",
            textUnderlineOffset: "5px",
          }}
        >
          {timeAgoText}
        </Typography>
      </Tooltip>
      {user && (
        <>
          {" "}
          by <GetReferenceUrlValue {...user} />
        </>
      )}
    </Typography>
  );
};
