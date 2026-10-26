import { Tooltip } from "../../../ui";
import { Label } from "../../../ui/Label";

interface PendingChangeBadgeProps {
  label?: string;
}

export const PendingChangeBadge = ({
  label = "Awaiting approval",
}: PendingChangeBadgeProps) => {
  return (
    <Tooltip title="This update is staged and will take effect after approval.">
      <Label tone="warning" label={label} />
    </Tooltip>
  );
};

export default PendingChangeBadge;
