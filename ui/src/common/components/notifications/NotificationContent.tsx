import { forwardRef } from "react";

import { toast } from "sonner";

import { HeroCheckCircleIcon } from "../../../icons";
import {
  HeroExclamationCircleIcon,
  HeroExclamationTriangleIcon,
  HeroInformationCircleIcon,
} from "../../../icons";
import { HeroXMarkIcon } from "../../../icons";
import { IconButton } from "../../../ui";
import { cn } from "../../../utils/cn";

export type SnackbarVariant =
  "success" | "error" | "warning" | "info" | "default";

interface NotificationContentProps {
  id: string | number;
  message: string;
  variant: SnackbarVariant;
  title?: string;
}

// The light palette's dark shades (themePrimitives), in both color schemes
// so the white text keeps its contrast.
const VARIANT_BG: Record<SnackbarVariant, string> = {
  default: "bg-grey-700",
  success: "bg-tint-green-700",
  error: "bg-tint-red-800",
  warning: "bg-tint-orange-800",
  info: "bg-tint-blue-700",
};

const variantIcons = {
  default: HeroInformationCircleIcon,
  success: HeroCheckCircleIcon,
  error: HeroExclamationCircleIcon,
  warning: HeroExclamationTriangleIcon,
  info: HeroInformationCircleIcon,
};

export const NotificationContent = forwardRef<
  HTMLDivElement,
  NotificationContentProps
>(({ id, message, variant, title }, ref) => {
  const closeSnackbar = (key: string | number) => toast.dismiss(key);
  const DynamicIcon = variantIcons[variant];
  const iconColor = "#fff";

  return (
    <div
      ref={ref}
      className={cn(
        "flex min-w-[300px] items-start rounded-surface p-3 text-white shadow-[0_3px_3px_-2px_rgba(0,0,0,0.2),0_3px_4px_0_rgba(0,0,0,0.14),0_1px_8px_0_rgba(0,0,0,0.12)] sm:min-w-[400px]",
        VARIANT_BG[variant],
      )}
    >
      <DynamicIcon className="mt-1 mr-4 shrink-0 text-white" />

      <div className="min-w-0 grow pr-2">
        <div className="flex items-start justify-between">
          <div className="grow">
            <h6 className="m-0 text-subtitle2 font-bold text-grey-500">
              {title}
            </h6>
            <p className="m-0 mt-1 text-body2 wrap-break-word text-[rgba(255,_255,_255,_0.9)]">
              {message}
            </p>
          </div>

          <IconButton
            style={{ color: iconColor }}
            className="ml-2 opacity-80 hover:bg-white/10 hover:opacity-100"
            onClick={() => closeSnackbar(id)}
            size="small"
          >
            <HeroXMarkIcon fontSize="small" />
          </IconButton>
        </div>
      </div>
    </div>
  );
});

NotificationContent.displayName = "NotificationContent";
