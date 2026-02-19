import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Chip, Tooltip } from "@mui/material";
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
  updatedAt?: Date | string;
  sx?: SxProps<Theme>;
}

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

const StatusChip = ({ status, state, updatedAt }: StatusChipProps) => {
  const colors = getStateColor(status, state);
  const stateValue = state ? `${state} [${status}]` : status;
  const staleThresholdMs = 30 * 60 * 1000;
  const isStale = (() => {
    if (!updatedAt) {
      return false;
    }
    if (status !== "in_progress") {
      return false;
    }
    const parsedDate = new Date(updatedAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return false;
    }
    return Date.now() - parsedDate.getTime() >= staleThresholdMs;
  })();

  const label = (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      <code>{stateValue.toLocaleUpperCase()}</code>
      {isStale && (
        <Tooltip title="This entity may be stale. You can reset state.">
          <Box
            component="span"
            sx={{ display: "inline-flex", alignItems: "center" }}
          >
            <WarningAmberIcon sx={{ fontSize: 14 }} />
          </Box>
        </Tooltip>
      )}
    </Box>
  );

  return (
    <Chip
      label={label}
      variant="outlined"
      size="small"
      sx={(theme) => ({
        backgroundColor: `${getThemeColor(theme, colors.backgroundColor)} !important`,
        borderColor: `${getThemeColor(theme, colors.borderColor)} !important`,
        "& .MuiChip-label": {
          color: `${getThemeColor(theme, colors.color)} !important`,
        },
      })}
    />
  );
};

export default StatusChip;
