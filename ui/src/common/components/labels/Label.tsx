import type { ChipProps } from "../../../ui";
import { Chip } from "../../../ui";
import { cn } from "../../../utils/cn";

/**
 * Built-in Label tones. Each maps to a palette-backed, theme-aware style
 * pair (light + dark) so consumers pick a semantic look instead of
 * hand-writing colors.
 *
 * default: the classic outlined white/gray chip (the original look).
 * primary / secondary / info / success / warning / error: outlined
 *   chips tinted with that palette color in both modes.
 */
export type LabelTone =
  | "default"
  | "primary"
  | "secondary"
  | "info"
  | "success"
  | "warning"
  | "error";

const toneClasses: Record<LabelTone, string> = {
  default: "",
  primary: "text-primary border-primary dark:border-primary",
  secondary: "text-secondary border-secondary dark:border-secondary",
  info: "text-info border-info dark:border-info",
  success: "text-success border-success dark:border-success",
  warning: "text-warning border-warning dark:border-warning",
  error: "text-error border-error dark:border-error",
};

const sizeClasses = {
  small: "h-[18px] max-h-none text-[0.6875rem]",
  medium: "h-6 max-h-none text-[0.8125rem]",
  large: "h-[30px] max-h-none text-sm",
} as const;

/** Visual size. Defaults to the compact small size used in tables. */
export type LabelSize = "small" | "medium" | "large";

export interface LabelProps extends Omit<ChipProps, "size"> {
  /** Built-in look; defaults to the classic outlined default chip. */
  tone?: LabelTone;
  /** Height and font size; defaults to small. */
  size?: LabelSize;
}

export const Label = ({
  tone = "default",
  size = "small",
  className,
  ...chipProps
}: LabelProps) => {
  const chipColor = tone === "default" ? undefined : tone;
  return (
    <Chip
      variant="outlined"
      {...(chipColor ? { color: chipColor } : {})}
      className={cn(
        "rounded-full border-[#d0d7de] bg-white dark:border-[#3d444d] dark:bg-[#21262d]",
        sizeClasses[size],
        toneClasses[tone],
        className,
      )}
      labelClassName="px-1"
      {...chipProps}
    />
  );
};
