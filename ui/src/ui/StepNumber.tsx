import { cn } from "../utils/cn";

export interface StepNumberProps {
  step: number;
  className?: string;
}

/** Filled circle with a step number, for ordered instructions and step lists. */
export function StepNumber({ step, className }: StepNumberProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.75rem] leading-[1] text-primary-contrast",
        className,
      )}
    >
      {step}
    </span>
  );
}
