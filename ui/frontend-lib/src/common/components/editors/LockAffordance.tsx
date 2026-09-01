import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, IconButton, Tooltip } from "@mui/material";

interface LockAffordanceProps {
  /** Whether the field is currently locked (shows a solid lock) or unlocked. */
  locked: boolean;
  onClick: () => void;
  /** Bold heading shown in the tooltip; also used as the accessible name. */
  title: string;
  /** Supporting line shown under the title with the reason + action. */
  description?: string;
}

/**
 * Inline lock affordance for protected fields. Renders as a persistent icon
 * that communicates the lock state at a glance: a solid lock when locked
 * (click to unlock) and a lock-open icon when unlocked (click to lock).
 */
export const LockAffordance = ({
  locked,
  onClick,
  title,
  description,
}: LockAffordanceProps) => {
  const button = (
    <IconButton
      size="small"
      onClick={onClick}
      aria-label={description ? `${title}. ${description}` : title}
      sx={{
        width: 28,
        height: 28,
        flexShrink: 0,
        border: "1px solid transparent",
        // Same default icon color as the edit (pencil) affordance. Always
        // visible in both states so the lock status is never ambiguous.
        "&:hover": {
          backgroundColor: "action.hover",
          borderColor: "divider",
        },
      }}
    >
      {locked ? (
        <LockOutlinedIcon fontSize="small" />
      ) : (
        <LockOpenOutlinedIcon fontSize="small" />
      )}
    </IconButton>
  );

  return (
    <Tooltip
      title={
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Box component="span" sx={{ fontWeight: 600 }}>
            {title}
          </Box>
          {description ? (
            <Box component="span" sx={{ fontWeight: 400, opacity: 0.85 }}>
              {description}
            </Box>
          ) : null}
        </Box>
      }
    >
      <span>{button}</span>
    </Tooltip>
  );
};

export default LockAffordance;
