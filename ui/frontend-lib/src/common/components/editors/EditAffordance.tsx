import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { IconButton, Tooltip } from "@mui/material";

interface EditAffordanceProps {
  /** Class applied to the button so a parent can reveal it on hover/focus. */
  className?: string;
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
  /** Tooltip shown when disabled (explains why editing isn't allowed). */
  disabledTooltip?: string;
  /** Tooltip shown when enabled. */
  title?: string;
}

/**
 * Ghost pencil button used as the click-to-edit affordance for metadata
 * fields. Renders invisible until its container is hovered/focused (via
 * `className`), then appears as a subtle icon that fills on hover.
 */
export const EditAffordance = ({
  className,
  onClick,
  ariaLabel,
  disabled = false,
  disabledTooltip = "You do not have permission to edit this field",
  title = "Edit",
}: EditAffordanceProps) => {
  const button = (
    <IconButton
      className={className}
      size="small"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      sx={{
        opacity: 0,
        transition:
          "opacity 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out",
        width: 24,
        height: 24,
        padding: 2,
        flexShrink: 0,
        border: "1px solid transparent",
        backgroundColor: "transparent",
        "&:hover": {
          backgroundColor: "action.hover",
          borderColor: "divider",
        },
        "&:focus-visible": { opacity: 1 },
      }}
    >
      <EditOutlinedIcon fontSize="small" />
    </IconButton>
  );

  return (
    <Tooltip title={disabled ? disabledTooltip : title}>
      <span>{button}</span>
    </Tooltip>
  );
};

export default EditAffordance;
