import { cn, IconButton, IconButtonProps } from "@electrolux-oss/infrakitchen";

export interface MenuButtonProps extends IconButtonProps {
  showBadge?: boolean;
}

/** IconButton with an optional red dot (daisyUI indicator + status). */
export default function MenuButton({
  showBadge = false,
  ...props
}: MenuButtonProps) {
  return (
    <span className="d-indicator">
      <span
        aria-hidden
        className={cn(
          "d-indicator-item top-0.5 right-0.5 d-status size-2 d-status-error",
          !showBadge && "hidden",
        )}
      />
      <IconButton size="small" {...props} />
    </span>
  );
}
