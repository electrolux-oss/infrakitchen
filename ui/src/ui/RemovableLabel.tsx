import { forwardRef, MouseEvent } from "react";

import { HeroXCircleIcon } from "../icons";

import { Label, LabelProps } from "./Label";

export interface RemovableLabelProps extends Omit<
  LabelProps,
  "children" | "component" | "clickable"
> {
  onRemove?: (event: MouseEvent<HTMLButtonElement>) => void;
  removeLabel?: string;
}

/** Selected input value with a removal control, using the shared Label design. */
export const RemovableLabel = forwardRef<HTMLElement, RemovableLabelProps>(
  function RemovableLabel({ onRemove, removeLabel = "Remove", ...props }, ref) {
    return (
      <Label {...props} ref={ref} component="span">
        {onRemove && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={removeLabel}
            className="mr-1 -ml-1 inline-flex cursor-pointer border-0 bg-transparent p-0 text-inherit opacity-70 hover:opacity-100 [&_svg]:text-caption"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(event);
            }}
          >
            <HeroXCircleIcon />
          </button>
        )}
      </Label>
    );
  },
);
