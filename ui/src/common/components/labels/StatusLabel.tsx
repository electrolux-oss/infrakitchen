import React from "react";

import {
  HeroCheckCircleIcon,
  HeroClockIcon,
  HeroNoSymbolIcon,
  HeroXCircleIcon,
  HeroExclamationTriangleIcon,
} from "../../../icons";
import { Tooltip } from "../../../ui";
import { Label, type LabelSize, type LabelTone } from "../../../ui/Label";
import { cn } from "../../../utils/cn";
import { getStateColor, paletteTextClass } from "../../utils";

// All status glyphs are Heroicons outlines (24px grid, 1.5px stroke), so the
// pill's icon family stays consistent: check-circle, x-circle, no-symbol
// (disabled/destroyed), clock (pending/unknown fallback).
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  "success.main": HeroCheckCircleIcon,
  "error.main": HeroXCircleIcon,
  "grey.400": HeroNoSymbolIcon,
};

// getStateColor palette paths mapped to the Label tones with matching hues.
const TONE_BY_BACKGROUND: Record<string, LabelTone> = {
  "success.main": "success",
  "error.main": "error",
  "warning.main": "warning",
  "info.dark": "info",
  "grey.400": "default",
  "grey.200": "default",
};

export interface StatusLabelProps {
  status: string;
  state?: string;
  /** Class names applied to the status icon (compact) or the Label. */
  className?: string;
  /**
   * Icon-only rendering with the status in a tooltip, for dense contexts like
   * graph nodes, tree rows and overview cards.
   */
  compact?: boolean;
  /** The entity has pending changes in its temporary state to review. */
  needsReview?: boolean;
  /** Visual size; omitted to inherit Label's default (medium). */
  size?: LabelSize;
}

const REVIEW_HINT = "Has pending changes that should be reviewed";

/**
 * Entity status as a Label pill: the `STATE [STATUS]` text the sidebar used to
 * render as plain icon + text, now standardized on Label. Reads the status
 * tone from common/utils so every surface stays consistent.
 */
export const StatusLabel = ({
  status,
  state,
  compact = false,
  className,
  needsReview = false,
  size,
}: StatusLabelProps) => {
  const stateValue = state ? `${state} [${status}]` : status;
  const colors = getStateColor(status, state);
  const Icon = ICON_MAP[colors.backgroundColor] || HeroClockIcon;

  const label = compact ? (
    <Tooltip title={stateValue.toUpperCase()}>
      <Icon
        fontSize="small"
        className={cn(
          "cursor-pointer",
          paletteTextClass(colors.backgroundColor),
          className,
        )}
      />
    </Tooltip>
  ) : (
    <Label
      icon={<Icon />}
      size={size}
      case="uppercase"
      tone={TONE_BY_BACKGROUND[colors.backgroundColor] ?? "default"}
      label={stateValue}
      className={className}
    />
  );

  if (!needsReview) return label;

  return (
    <div className="flex max-w-full items-center gap-2 overflow-hidden">
      {/* The status pill truncates first so "Needs review" is never clipped. */}
      <span className="flex min-w-0 shrink">{label}</span>
      <Tooltip title={REVIEW_HINT}>
        {compact ? (
          <span className="inline-flex shrink-0 text-warning">
            <HeroExclamationTriangleIcon
              fontSize="small"
              aria-label="Needs review"
            />
          </span>
        ) : (
          <span className="inline-flex shrink-0">
            <Label size={size} tone="warning" label="Needs review" />
          </span>
        )}
      </Tooltip>
    </div>
  );
};

export default StatusLabel;
