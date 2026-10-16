import { Chip, Tooltip } from "@mui/material";

import { solidChipColorSx } from "../../utils/softChip";

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
        sx={solidChipColorSx("warning")}
      />
    </Tooltip>
  );
};

export default PendingChangeBadge;
