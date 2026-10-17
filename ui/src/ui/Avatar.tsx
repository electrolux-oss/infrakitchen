import { forwardRef, HTMLAttributes } from "react";

import { cn } from "../utils/cn";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
}

/** Round initials/image avatar (daisyUI `avatar`). */
export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  { src, alt, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "d-avatar relative d-avatar-placeholder inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-grey-400 font-sans text-[1.25rem] leading-none text-paper select-none",
        className,
      )}
      {...rest}
    >
      {src ? (
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        children
      )}
    </div>
  );
});
