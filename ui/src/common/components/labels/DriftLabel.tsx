import type { ReactElement } from "react";

import { HeroExclamationTriangleIcon } from "../../../icons";
import { Tooltip } from "../../../ui";
import { Label, type LabelSize, type LabelTone } from "../../../ui/Label";
import { DRIFT_STATUS } from "../../../utils/constants";

export interface DriftLabelProps {
  driftStatus?: string | null;
  checkedAt?: string | null;
  /** checks that failed in a row since the last successful one */
  consecutiveFailures?: number | null;
  lastError?: string | null;
  size?: LabelSize;
  className?: string;
}

const DRIFT_PRESENTATION: Record<string, { label: string; tone: LabelTone }> = {
  [DRIFT_STATUS.IN_SYNC]: { label: "In sync", tone: "success" },
  [DRIFT_STATUS.DRIFTED]: { label: "Drifted", tone: "warning" },
  [DRIFT_STATUS.ERROR]: { label: "Drift check failed", tone: "error" },
};

const withTooltip = (title: string | null, label: ReactElement) =>
  title ? (
    <Tooltip title={title}>
      <span className="inline-flex">{label}</span>
    </Tooltip>
  ) : (
    label
  );

/**
 * Result of the last successful drift check, and a "Check failing" marker
 * when the checks after it failed. Renders nothing for a resource that was
 * never checked (including every resource while drift detection is off), so
 * the list and the header stay unchanged until the feature is used.
 */
export const DriftLabel = ({
  driftStatus,
  checkedAt,
  consecutiveFailures,
  lastError,
  size,
  className,
}: DriftLabelProps) => {
  // GraphQL returns enum names (DRIFTED), live events return values (drifted)
  const status = driftStatus?.toLowerCase();
  const presentation = status ? DRIFT_PRESENTATION[status] : null;
  // a resource without a successful check is already labelled as failed
  const failing =
    (consecutiveFailures ?? 0) > 0 && status !== DRIFT_STATUS.ERROR;
  if (!presentation && !failing) return null;

  // the time of the last successful check, or of a successful apply after it
  const checked = checkedAt
    ? `As of ${new Date(checkedAt).toLocaleString()}`
    : null;
  return (
    <>
      {presentation &&
        withTooltip(
          status === DRIFT_STATUS.ERROR && lastError ? lastError : checked,
          <Label
            className={className}
            size={size}
            tone={presentation.tone}
            label={presentation.label}
            icon={
              status === DRIFT_STATUS.DRIFTED ? (
                <HeroExclamationTriangleIcon />
              ) : undefined
            }
          />,
        )}
      {failing &&
        withTooltip(
          lastError ? `Last drift check failed: ${lastError}` : null,
          <Label
            className={className}
            size={size}
            tone="error"
            label="Check failing"
          />,
        )}
    </>
  );
};

export default DriftLabel;
