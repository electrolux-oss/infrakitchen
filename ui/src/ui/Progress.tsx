import { cn } from "../utils/cn";

/** Indeterminate 8px progress bar (daisyUI `progress`). */
export function LinearProgress({ className }: { className?: string }) {
  return (
    <progress
      aria-label="Loading"
      className={cn(
        "d-progress block h-2 w-full rounded-[8px] bg-grey-200 text-primary dark:bg-grey-800",
        className,
      )}
    />
  );
}

export interface SkeletonProps {
  variant?: "text" | "rectangular" | "rounded" | "circular";
  width?: number | string;
  height?: number | string;
  className?: string;
}

/** Loading placeholder (daisyUI `skeleton`). */
export function Skeleton({
  variant = "text",
  width,
  height,
  className,
}: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "block d-skeleton bg-hover",
        variant === "text" &&
          "my-0 h-5 origin-[0_55%] scale-y-[0.6] rounded-[4px]",
        variant === "rounded" && "rounded-surface",
        variant === "rectangular" && "rounded-none",
        variant === "circular" && "rounded-full",
        className,
      )}
      style={{ width, height }}
    />
  );
}
