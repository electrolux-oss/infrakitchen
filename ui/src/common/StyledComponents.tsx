import { Tab, TabProps } from "../ui";
import { cn } from "../utils/cn";

/**
 * Segmented-control tab: bordered pill that fills with the primary color
 * when selected. Pair with `<Tabs hideIndicator>`.
 */
export const StyledTab = ({ className, ...props }: TabProps) => (
  <Tab
    className={cn(
      "rounded-surface border border-divider bg-paper font-medium text-fg-muted aria-selected:border-primary aria-selected:bg-primary aria-selected:text-primary-contrast",
      className,
    )}
    {...props}
  />
);
