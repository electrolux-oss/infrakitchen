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

// Same tints as the error cards and the standard Alert.
const VARIANT_BG: Record<SnackbarVariant, string> = {
  default:
    "border-grey-300/50 bg-grey-100 dark:border-grey-700/50 dark:bg-grey-800",
  success:
    "border-tint-green-300/50 bg-tint-green-100 dark:border-tint-green-800/50 dark:bg-tint-green-900",
  error:
    "border-tint-red-300/50 bg-tint-red-100 dark:border-tint-red-800/50 dark:bg-tint-red-900",
  warning:
    "border-tint-orange-300/50 bg-tint-orange-100 dark:border-tint-orange-800/50 dark:bg-tint-orange-900",
  info: "border-tint-blue-300/50 bg-tint-blue-100 dark:border-tint-blue-800/50 dark:bg-tint-blue-900",
};

const VARIANT_ICON: Record<SnackbarVariant, string> = {
  default: "text-fg-muted",
  success: "text-tint-green-500",
  error: "text-tint-red-400",
  warning: "text-tint-orange-500",
  info: "text-tint-blue-500",
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

  return (
    <div
      ref={ref}
      className={cn(
        "flex min-w-[300px] items-start rounded-surface border p-3 text-fg shadow-[0_3px_3px_-2px_rgba(0,0,0,0.2),0_3px_4px_0_rgba(0,0,0,0.14),0_1px_8px_0_rgba(0,0,0,0.12)] sm:min-w-[400px]",
        VARIANT_BG[variant],
      )}
    >
      <DynamicIcon
        className={cn("mt-0.5 mr-3 shrink-0", VARIANT_ICON[variant])}
      />

      <div className="min-w-0 grow pr-2">
        <div className="flex items-start justify-between">
          <div className="grow">
            <h6 className="m-0 text-body2 font-semibold text-fg">{title}</h6>
            <p className="m-0 mt-1 text-body2 wrap-break-word text-fg">
              {message}
            </p>
          </div>

          <IconButton
            className="-mt-0.5 ml-2 p-0.5"
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
