import { IconButton, IconButtonProps } from "../../../ui";
import { cn } from "../../../utils/cn";

/** IconButton whose icon turns upside down while `expanded`. */
export const ExpandIconButton = ({
  expanded,
  className,
  ...props
}: IconButtonProps & { expanded: boolean }) => (
  <IconButton
    className={cn(
      "p-2 transition-transform duration-150",
      expanded ? "rotate-180" : "rotate-0",
      className,
    )}
    {...props}
  />
);
