import { WarningAmberIcon } from "../icons/material";
import { Chip, Tooltip, type ChipColor } from "../ui";
import { cn } from "../utils/cn";
import { VERSION_LIFECYCLE_STATE } from "../utils/constants";

const VERSION_LIFECYCLE_STATE_COLORS: Partial<
  Record<VERSION_LIFECYCLE_STATE, ChipColor>
> = {
  [VERSION_LIFECYCLE_STATE.ACTIVE]: "success",
  [VERSION_LIFECYCLE_STATE.PREVIEW]: "info",
  [VERSION_LIFECYCLE_STATE.DEPRECATED]: "warning",
  [VERSION_LIFECYCLE_STATE.ARCHIVED]: "error",
};

const DOT_COLORS: Record<ChipColor, string> = {
  default: "bg-grey-400",
  primary: "bg-primary",
  secondary: "bg-secondary",
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  error: "bg-error",
};

export const getVersionLifecycleStateColor = (
  lifecycleStateValue: string | undefined,
): ChipColor => {
  const lifecycleState = lifecycleStateValue?.toLocaleLowerCase() as
    VERSION_LIFECYCLE_STATE | undefined;

  return lifecycleState
    ? (VERSION_LIFECYCLE_STATE_COLORS[lifecycleState] ?? "default")
    : "default";
};

interface VersionLifecycleStateChipProps {
  lifecycleState: VERSION_LIFECYCLE_STATE | string;
  className?: string;
  breakingChanges?: string;
  /**
   * `chip` is the full labelled pill; `dot` is a small colored dot with the
   * state in a tooltip, for dense contexts like grid rows.
   */
  variant?: "chip" | "dot";
  /**
   * Suppress the built-in breaking-changes warning icon so the caller can
   * position it separately (e.g. trailing the entity name in dot layouts).
   */
  hideBreakingChangesWarning?: boolean;
}

const VersionLifecycleStateChip = ({
  lifecycleState,
  className,
  breakingChanges,
  variant = "chip",
  hideBreakingChangesWarning = false,
}: VersionLifecycleStateChipProps) => {
  const normalizedState =
    lifecycleState?.toLowerCase() || VERSION_LIFECYCLE_STATE.UNKNOWN;
  const color = getVersionLifecycleStateColor(normalizedState);
  const hasBreakingChanges =
    !hideBreakingChangesWarning && Boolean(breakingChanges?.trim());

  if (variant === "dot") {
    return (
      <div className="inline-flex items-center gap-1.5">
        <Tooltip
          title={
            hasBreakingChanges
              ? `${normalizedState} — ${breakingChanges}`
              : normalizedState
          }
        >
          <span
            aria-label={normalizedState}
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              DOT_COLORS[color],
              className,
            )}
          />
        </Tooltip>
        {hasBreakingChanges ? (
          <Tooltip title={breakingChanges}>
            <WarningAmberIcon color="warning" fontSize="small" />
          </Tooltip>
        ) : null}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Chip
        label={normalizedState}
        appearance="solid"
        color={color}
        className={cn("font-medium uppercase", className)}
      />
      {hasBreakingChanges ? (
        <Tooltip title={breakingChanges}>
          <WarningAmberIcon color="warning" fontSize="small" />
        </Tooltip>
      ) : null}
    </div>
  );
};

export default VersionLifecycleStateChip;
