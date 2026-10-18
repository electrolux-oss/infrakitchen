import React from "react";

import {
  BlockOutlinedIcon,
  CancelOutlinedIcon,
  CheckCircleOutlinedIcon,
  PendingOutlinedIcon,
  WarningAmberIcon,
} from "../icons/material";
import { Chip, Tooltip } from "../ui";
import { cn } from "../utils/cn";
import {
  ENTITY_STATE,
  ENTITY_STATUS,
  INTEGRATION_STATUS,
  WORKER_STATUS,
} from "../utils/constants";

import { getStateColor, paletteTextClass } from "./utils";

interface StatusChipProps {
  status: INTEGRATION_STATUS | ENTITY_STATUS | WORKER_STATUS | string;
  state?: ENTITY_STATE | string;
  /** Class names applied to the status icon. */
  className?: string;
  compact?: boolean;
  /** The entity has pending changes in its temporary state to review. */
  needsReview?: boolean;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  "success.main": CheckCircleOutlinedIcon,
  "error.main": CancelOutlinedIcon,
  "grey.400": BlockOutlinedIcon,
};

const renderIconWithText = (
  icon: React.ComponentType<any>,
  stateValue: string,
  colors: any,
  compact: boolean,
  className?: string,
) => {
  const Icon = icon;
  const colorClass = paletteTextClass(colors.backgroundColor);

  if (compact) {
    return (
      <Tooltip title={stateValue.toUpperCase()}>
        <Icon
          fontSize="small"
          className={cn("cursor-pointer", colorClass, className)}
        />
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Icon fontSize="small" className={cn(colorClass, className)} />
      <div className={colorClass}>{stateValue.toUpperCase()}</div>
    </div>
  );
};

const REVIEW_HINT = "Has pending changes that should be reviewed";

const StatusChip = ({
  status,
  state,
  compact = false,
  className,
  needsReview = false,
}: StatusChipProps) => {
  const colors = getStateColor(status, state);
  const stateValue = state ? `${state} [${status}]` : status;

  const IconComponent = iconMap[colors.backgroundColor] || PendingOutlinedIcon;

  const chip = renderIconWithText(
    IconComponent,
    stateValue,
    colors,
    compact,
    className,
  );

  if (!needsReview) return chip;

  return (
    <div className="flex items-center gap-2">
      {chip}
      <Tooltip title={REVIEW_HINT}>
        {compact ? (
          <span className="inline-flex text-warning">
            <WarningAmberIcon fontSize="small" aria-label="Needs review" />
          </span>
        ) : (
          <span className="inline-flex">
            <Chip size="small" color="warning" label="Needs review" />
          </span>
        )}
      </Tooltip>
    </div>
  );
};

export default StatusChip;
