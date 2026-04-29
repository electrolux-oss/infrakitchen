import { toast } from "sonner";

import { ApiClientError } from "../../errors";
import { SnackbarVariant, DependencyError } from "../components/notifications";
import { ErrorWithStatusCode } from "../components/notifications/ErrorWithStatusCode";

interface NotifyOptions {
  duration?: number;
}

function getMessage(message: any) {
  try {
    return JSON.stringify(message, null, 2);
  } catch {
    return String(message);
  }
}

const toastForVariant = (variant: SnackbarVariant) => {
  switch (variant) {
    case "success":
      return toast.success;
    case "error":
      return toast.error;
    case "warning":
      return toast.warning;
    case "info":
      return toast.info;
    default:
      return toast;
  }
};

export const notify = (
  message: any,
  variant: SnackbarVariant,
  options?: NotifyOptions,
) => {
  const messageStr =
    typeof message === "string" ? message : getMessage(message);
  toastForVariant(variant)(messageStr, {
    duration: options?.duration ?? 5000,
    toasterId: "global",
  });
};

export const notifyError = (error: unknown, options?: NotifyOptions) => {
  if (error instanceof ApiClientError) {
    const displayMessage = `${error.status} ${getMessage(error.message)}`;

    if (error.error_code === "DEPENDENCY_ERROR") {
      toast.custom(
        (id) => (
          <DependencyError
            id={id}
            message={displayMessage}
            metadata={error.metadata}
          />
        ),
        { duration: Infinity, toasterId: "errors" },
      );
      return;
    }

    if (
      error.error_code &&
      error.error_code.toUpperCase() !== "UNKNOWN_ERROR"
    ) {
      toast.custom(
        (id) => (
          <ErrorWithStatusCode
            id={id}
            message={displayMessage}
            metadata={error.metadata}
          />
        ),
        { duration: Infinity, toasterId: "errors" },
      );
      return;
    }

    toast.error(displayMessage, { toasterId: "errors", ...options });
    return;
  }

  if (error instanceof Error) {
    toast.error(error.message, { toasterId: "errors", ...options });
    return;
  }

  toast.error("Request failed due to an unknown error.", {
    toasterId: "errors",
    ...options,
  });
};
