import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { Chip, Tooltip } from "@mui/material";

interface PendingChangeBadgeProps {
  label?: string;
}

export const PendingChangeBadge = ({
  label = "Awaiting approval",
}: PendingChangeBadgeProps) => {
  return (
    <Tooltip title="This update is staged and will take effect after approval.">
      <Chip
        icon={<HourglassEmptyIcon />}
        label={label}
        size="small"
        color="warning"
        variant="filled"
        sx={{
          alignSelf: "flex-start",
          fontWeight: 600,
          letterSpacing: 0.2,
          "& .MuiChip-icon": {
            fontSize: "1rem",
          },
        }}
      />
    </Tooltip>
  );
};

export default PendingChangeBadge;
