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
  /**
   * Keep the button invisible until its container is hovered/focused (the
   * container reveals it via `className`). Defaults to always visible.
   */
  revealOnHover?: boolean;
}

/**
 * Ghost pencil button used as the click-to-edit affordance for fields and
 * sections. Always visible by default; a subtle icon that fills on hover.
 */
export const EditAffordance = ({
  className,
  onClick,
  ariaLabel,
  disabled = false,
  disabledTooltip = "You do not have permission to edit this field",
  title = "Edit",
  revealOnHover = false,
}: EditAffordanceProps) => {
  const button = (
    <IconButton
      className={className}
      size="small"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      sx={{
        opacity: revealOnHover ? 0 : 1,
        transition:
          "opacity 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out",
        width: 20,
        height: 20,
        padding: 0,
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
      <EditOutlinedIcon sx={{ fontSize: 16 }} />
    </IconButton>
  );

  return (
    <Tooltip title={disabled ? disabledTooltip : title}>
      <span style={{ display: "inline-flex" }}>{button}</span>
    </Tooltip>
  );
};

export default EditAffordance;
