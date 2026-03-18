import React from "react";

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
) => {
  const Icon = icon;

  if (compact) {
    return (
      <Tooltip title={stateValue.toUpperCase()}>
        <Icon
          fontSize="small"
          sx={(theme) => ({
            color: getThemeColor(theme, colors.backgroundColor),
            cursor: "pointer",
          })}
        />
      </Tooltip>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <Icon
        fontSize="small"
        sx={(theme) => ({
          color: getThemeColor(theme, colors.backgroundColor),
        })}
      />
      <Box
        sx={(theme) => ({
          color: getThemeColor(theme, colors.backgroundColor),
          fontWeight: 500,
        })}
      >
        {stateValue.toUpperCase()}
      </Box>
    </Box>
  );
};

const StatusChip = ({ status, state, compact = false }: StatusChipProps) => {
  const colors = getStateColor(status, state);
  const stateValue = state ? `${state} [${status}]` : status;

  const IconComponent = iconMap[colors.backgroundColor] || PendingIcon;

  return renderIconWithText(IconComponent, stateValue, colors, compact);
};

export default StatusChip;
