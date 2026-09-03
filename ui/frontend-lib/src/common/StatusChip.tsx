import React from "react";

import BlockIcon from "@mui/icons-material/Block";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import { Tooltip, Box } from "@mui/material";
import { SxProps, Theme } from "@mui/system";

import {
  ENTITY_STATE,
  ENTITY_STATUS,
  INTEGRATION_STATUS,
  WORKER_STATUS,
} from "../utils/constants";

import { getStateColor } from "./utils";

interface StatusChipProps {
  status: INTEGRATION_STATUS | ENTITY_STATUS | WORKER_STATUS | string;
  state?: ENTITY_STATE | string;
  sx?: SxProps<Theme>;
  compact?: boolean;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  "success.main": CheckCircleIcon,
  "error.main": CancelIcon,
  "grey.400": BlockIcon,
};

const getThemeColor = (theme: any, colorPath: string) => {
  const [category, shade] = colorPath.split(".");

  if (category === "text" || category === "background") {
    return (theme.palette as any)[category]?.[shade] || colorPath;
  }

  if (category === "grey") {
    return (theme.palette as any).grey?.[shade] || colorPath;
  }

  return (theme.palette as any)[category]?.[shade] || colorPath;
};

const renderIconWithText = (
  icon: React.ComponentType<any>,
  stateValue: string,
  colors: any,
  compact: boolean,
  sx?: SxProps<Theme>,
) => {
  const Icon = icon;

  if (compact) {
    return (
      <Tooltip title={stateValue.toUpperCase()}>
        <Icon
          fontSize="small"
          sx={[
            (theme: Theme) => ({
              color: getThemeColor(theme, colors.backgroundColor),
              cursor: "pointer",
            }),
            ...(Array.isArray(sx) ? sx : [sx]),
          ]}
        />
      </Tooltip>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <Icon
        fontSize="small"
        sx={[
          (theme: Theme) => ({
            color: getThemeColor(theme, colors.backgroundColor),
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      />
      <Box
        sx={(theme) => ({
          color: getThemeColor(theme, colors.backgroundColor),
        })}
      >
        {stateValue.toUpperCase()}
      </Box>
    </Box>
  );
};

const StatusChip = ({
  status,
  state,
  compact = false,
  sx,
}: StatusChipProps) => {
  const colors = getStateColor(status, state);
  const stateValue = state ? `${state} [${status}]` : status;

  const IconComponent = iconMap[colors.backgroundColor] || PendingIcon;

  return renderIconWithText(IconComponent, stateValue, colors, compact, sx);
};

export default StatusChip;
