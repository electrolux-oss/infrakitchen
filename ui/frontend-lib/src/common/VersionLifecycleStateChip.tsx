import React from "react";

import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Chip, Tooltip } from "@mui/material";
import { SxProps, Theme } from "@mui/system";

import { VERSION_LIFECYCLE_STATE } from "../utils/constants";

import { MuiChipColor } from "./utils";
import { solidChipColorSx } from "./utils/softChip";

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

const VersionLifecycleStateChip = ({
  lifecycleState,
  sx,
  breakingChanges,
}: VersionLifecycleStateChipProps) => {
  const normalizedState =
    lifecycleState?.toLowerCase() || VERSION_LIFECYCLE_STATE.UNKNOWN;
  const color = getVersionLifecycleStateColor(normalizedState);
  const hasBreakingChanges = Boolean(breakingChanges?.trim());

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      <Chip
        label={normalizedState}
        size="small"
        sx={(theme) => ({
          ...solidChipColorSx(color)(theme),
          textTransform: "uppercase",
          fontWeight: 500,
          ...(sx as object),
        })}
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
