import { EditOutlinedIcon } from "../../../icons/material";
import { IconButton, Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";

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
      className={cn(
        "[transition:opacity_0.15s_ease-in-out,_background-color_0.15s_ease-in-out,_border-color_0.15s_ease-in-out]",
        "size-5 shrink-0 border border-transparent bg-transparent p-0 hover:border-divider hover:bg-hover focus-visible:opacity-100",
        revealOnHover ? "opacity-0" : "opacity-100",
        className,
      )}
      size="small"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <EditOutlinedIcon className="text-[16px]" />
    </IconButton>
  );

  return (
    <Tooltip title={disabled ? disabledTooltip : title}>
      <span style={{ display: "inline-flex" }}>{button}</span>
    </Tooltip>
  );
};
