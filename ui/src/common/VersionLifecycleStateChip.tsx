import { HeroExclamationTriangleIcon } from "../icons";
import { Tooltip } from "../ui";
import { cn } from "../utils/cn";
import { VERSION_LIFECYCLE_STATE } from "../utils/constants";

import { Label, type LabelTone } from "./components/labels";

const VERSION_LIFECYCLE_STATE_COLORS: Partial<
  Record<VERSION_LIFECYCLE_STATE, LabelTone>
> = {
  [VERSION_LIFECYCLE_STATE.ACTIVE]: "success",
  [VERSION_LIFECYCLE_STATE.PREVIEW]: "info",
  [VERSION_LIFECYCLE_STATE.DEPRECATED]: "warning",
  [VERSION_LIFECYCLE_STATE.ARCHIVED]: "error",
};

const DOT_COLORS: Record<LabelTone, string> = {
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
): LabelTone => {
  const lifecycleState = lifecycleStateValue?.toLocaleLowerCase() as
    VERSION_LIFECYCLE_STATE | undefined;

  return lifecycleState
    ? (VERSION_LIFECYCLE_STATE_COLORS[lifecycleState] ?? "default")
    : "default";
};

interface VersionLifecycleStateChipProps {
  lifecycleState: VERSION_LIFECYCLE_STATE | string;
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
            className={cn("size-2.5 shrink-0 rounded-full", DOT_COLORS[color])}
          />
        </Tooltip>
        {hasBreakingChanges ? (
          <Tooltip title={breakingChanges}>
            <HeroExclamationTriangleIcon color="warning" fontSize="small" />
          </Tooltip>
        ) : null}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Label tone={color} case="uppercase" label={normalizedState} />
      {hasBreakingChanges ? (
        <Tooltip title={breakingChanges}>
          <HeroExclamationTriangleIcon color="warning" fontSize="small" />
        </Tooltip>
      ) : null}
    </div>
  );
};

export default VersionLifecycleStateChip;
