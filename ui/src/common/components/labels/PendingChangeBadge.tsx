import { Chip, Tooltip } from "../../../ui";

interface PendingChangeBadgeProps {
  label?: string;
}

export const PendingChangeBadge = ({
  label = "Awaiting approval",
}: PendingChangeBadgeProps) => {
  return (
    <Tooltip title="This update is staged and will take effect after approval.">
      <Chip
        label={label.toUpperCase()}
        size="medium"
        appearance="solid"
        color="warning"
      />
    </Tooltip>
  );
};

export default PendingChangeBadge;
