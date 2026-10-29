import { HeroExclamationTriangleIcon } from "../../../icons";
import { Tooltip } from "../../../ui";
import { Label, type LabelSize, type LabelTone } from "../../../ui/Label";
import { DRIFT_STATUS } from "../../../utils/constants";

export interface DriftLabelProps {
  driftStatus?: string | null;
  checkedAt?: string | null;
  size?: LabelSize;
  className?: string;
}

const DRIFT_PRESENTATION: Record<string, { label: string; tone: LabelTone }> = {
  [DRIFT_STATUS.IN_SYNC]: { label: "In sync", tone: "success" },
  [DRIFT_STATUS.DRIFTED]: { label: "Drifted", tone: "warning" },
  [DRIFT_STATUS.ERROR]: { label: "Drift check failed", tone: "error" },
};

/**
 * Result of the last drift check. Renders nothing for a resource that was
 * never checked (including every resource while drift detection is off), so
 * the list and the header stay unchanged until the feature is used.
 */
export const DriftLabel = ({
  driftStatus,
  checkedAt,
  size,
  className,
}: DriftLabelProps) => {
  // GraphQL returns enum names (DRIFTED), live events return values (drifted)
  const status = driftStatus?.toLowerCase();
  const presentation = status ? DRIFT_PRESENTATION[status] : null;
  if (!presentation) return null;

  const label = (
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
    />
  );

  if (!checkedAt) return label;
  return (
    <Tooltip title={`Last checked ${new Date(checkedAt).toLocaleString()}`}>
      <span className="inline-flex">{label}</span>
    </Tooltip>
  );
};

export default DriftLabel;
