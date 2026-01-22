import { Chip } from "@mui/material";
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

const StatusChip = ({ status, state }: StatusChipProps) => {
  const colors = getStateColor(status, state);
  const rawValue = state ? `${state} [${status}]` : status;
  const normalizedValue = rawValue
    ? rawValue.toString().toLocaleUpperCase()
    : "";

  return (
    <Chip
      label={<code>{normalizedValue}</code>}
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
