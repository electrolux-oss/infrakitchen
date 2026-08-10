import React from "react";

import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import UpdateIcon from "@mui/icons-material/Update";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Chip, Tooltip } from "@mui/material";
import { SxProps, Theme } from "@mui/system";

import { VERSION_LIFECYCLE_STATE } from "../utils/constants";

import { MuiChipColor } from "./utils";

export const getVersionLifecycleStateColor = (
  lifecycleStateValue: string | undefined,
): MuiChipColor => {
  const lifecycleState = lifecycleStateValue?.toLocaleLowerCase() as
    VERSION_LIFECYCLE_STATE | undefined;

  if (lifecycleState === VERSION_LIFECYCLE_STATE.ACTIVE) return "success";

  if (lifecycleState === VERSION_LIFECYCLE_STATE.PREVIEW) return "info";

  if (lifecycleState === VERSION_LIFECYCLE_STATE.DEPRECATED) return "warning";

  if (lifecycleState === VERSION_LIFECYCLE_STATE.ARCHIVED) return "error";

  return "default";
};

interface VersionLifecycleStateChipProps {
  lifecycleState: VERSION_LIFECYCLE_STATE | string;
  sx?: SxProps<Theme>;
  breakingChanges?: string;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  [VERSION_LIFECYCLE_STATE.ACTIVE]: CheckCircleIcon,
  [VERSION_LIFECYCLE_STATE.PREVIEW]: UpdateIcon,
  [VERSION_LIFECYCLE_STATE.DEPRECATED]: BlockIcon,
  [VERSION_LIFECYCLE_STATE.UNKNOWN]: PendingIcon,
};

const VersionLifecycleStateChip = ({
  lifecycleState,
  sx,
  breakingChanges,
}: VersionLifecycleStateChipProps) => {
  const normalizedState =
    lifecycleState?.toLowerCase() || VERSION_LIFECYCLE_STATE.UNKNOWN;
  const IconComponent = iconMap[normalizedState] || PendingIcon;
  const color = getVersionLifecycleStateColor(normalizedState);
  const hasBreakingChanges = Boolean(breakingChanges?.trim());

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      <Chip
        icon={<IconComponent fontSize="small" />}
        label={normalizedState}
        size="small"
        color={color}
        variant="outlined"
        sx={{ textTransform: "uppercase", fontWeight: 500, ...(sx as object) }}
      />
      {hasBreakingChanges ? (
        <Tooltip title={breakingChanges}>
          <WarningAmberIcon color="warning" fontSize="small" />
        </Tooltip>
      ) : null}
    </Box>
  );
};

export default VersionLifecycleStateChip;
