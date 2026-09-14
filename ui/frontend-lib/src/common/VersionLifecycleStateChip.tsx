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
              width: 8,
              height: 8,
              flexShrink: 0,
              borderRadius: "50%",
              // `default` resolves to a light grey that is nearly invisible on
              // white, so unknown states get a ring instead of a solid fill.
              ...(color === "default"
                ? {
                    border: `1.5px solid ${theme.palette.grey[400]}`,
                  }
                : { bgcolor: theme.palette[color].main }),
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
