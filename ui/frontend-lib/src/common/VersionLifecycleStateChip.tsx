import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Chip, Tooltip } from "@mui/material";
import { SxProps, Theme } from "@mui/system";

import { VERSION_LIFECYCLE_STATE } from "../utils/constants";

import { MuiChipColor } from "./utils";
import { resolveChipColor, solidChipColorSx } from "./utils/softChip";

const VERSION_LIFECYCLE_STATE_COLORS: Partial<
  Record<VERSION_LIFECYCLE_STATE, MuiChipColor>
> = {
  [VERSION_LIFECYCLE_STATE.ACTIVE]: "success",
  [VERSION_LIFECYCLE_STATE.PREVIEW]: "info",
  [VERSION_LIFECYCLE_STATE.DEPRECATED]: "warning",
  [VERSION_LIFECYCLE_STATE.ARCHIVED]: "error",
};

export const getVersionLifecycleStateColor = (
  lifecycleStateValue: string | undefined,
): MuiChipColor => {
  const lifecycleState = lifecycleStateValue?.toLocaleLowerCase() as
    VERSION_LIFECYCLE_STATE | undefined;

  return lifecycleState
    ? (VERSION_LIFECYCLE_STATE_COLORS[lifecycleState] ?? "default")
    : "default";
};

interface VersionLifecycleStateChipProps {
  lifecycleState: VERSION_LIFECYCLE_STATE | string;
  sx?: SxProps<Theme>;
  breakingChanges?: string;
  /**
   * `chip` is the full labelled pill; `dot` is a small colored dot with the
   * state in a tooltip, for dense contexts like grid rows.
   */
  variant?: "chip" | "dot";
}

const VersionLifecycleStateChip = ({
  lifecycleState,
  sx,
  breakingChanges,
  variant = "chip",
}: VersionLifecycleStateChipProps) => {
  const normalizedState =
    lifecycleState?.toLowerCase() || VERSION_LIFECYCLE_STATE.UNKNOWN;
  const color = getVersionLifecycleStateColor(normalizedState);
  const hasBreakingChanges = Boolean(breakingChanges?.trim());

  if (variant === "dot") {
    return (
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
        <Tooltip
          title={
            hasBreakingChanges
              ? `${normalizedState} — ${breakingChanges}`
              : normalizedState
          }
        >
          <Box
            component="span"
            aria-label={normalizedState}
            sx={(theme) => ({
              width: 10,
              height: 10,
              flexShrink: 0,
              borderRadius: "50%",
              bgcolor: resolveChipColor(color, theme),
              ...(sx as object),
            })}
          />
        </Tooltip>
        {hasBreakingChanges ? (
          <Tooltip title={breakingChanges}>
            <WarningAmberIcon color="warning" fontSize="small" />
          </Tooltip>
        ) : null}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      <Chip
        label={normalizedState}
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
