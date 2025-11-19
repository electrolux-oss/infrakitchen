import { enqueueSnackbar, SnackbarKey } from "notistack";

import { ApiClientError } from "../../errors";
import {
  SnackbarVariant,
  NotificationContent,
  DependencyError,
} from "../components/notifications";
import { ErrorWithStatusCode } from "../components/notifications/ErrorWithStatusCode";

interface NotifyOptions {
  persist?: boolean;
  autoHideDuration?: number | null;
  anchorOrigin?: {
    vertical: "top" | "bottom";
    horizontal: "left" | "center" | "right";
  };
  preventDuplicate?: boolean;
}

function getMessage(message: any) {
  try {
    return JSON.stringify(message, null, 2);
  } catch {
    return String(message);
  }
}

export const notify = (
  message: any,
  variant: SnackbarVariant,
  options?: NotifyOptions,
) => {
  enqueueSnackbar(message, {
    variant: variant,
    autoHideDuration: variant === "error" ? 30000 : 3000,
    anchorOrigin: { vertical: "top", horizontal: "right" },
    ...options,

    content: (snackbarKey: SnackbarKey) => (
      <NotificationContent
        id={snackbarKey}
        message={message}
        variant={variant}
      />
    ),
  });
};

export const notifyError = (error: unknown, options?: NotifyOptions) => {
  let displayMessage: string;

  if (error instanceof ApiClientError) {
    displayMessage = `${error.status} ${getMessage(error.message)}`;
    if (error.error_code === "DEPENDENCY_ERROR") {
      enqueueSnackbar(displayMessage, {
        anchorOrigin: {
          vertical: "bottom",
          horizontal: "right",
        },
        persist: true,
        ...options,
        content: (key) => (
          <DependencyError
            id={key}
            message={displayMessage}
            metadata={error.metadata}
          />
        ),
      });
    } else if (
      error.error_code &&
      error.error_code.toUpperCase() !== "UNKNOWN_ERROR"
    ) {
      enqueueSnackbar(displayMessage, {
        anchorOrigin: {
          vertical: "bottom",
          horizontal: "right",
        },
        persist: true,
        ...options,
        content: (key) => (
          <ErrorWithStatusCode
            id={key}
            message={displayMessage}
            metadata={error.metadata}
          />
        ),
      });
    } else {
      notify(displayMessage, "error", options);
    }
  } else if (error instanceof Error) {
    notify(`${error.message}`, "error", options);
  } else {
    displayMessage = `Request failed due to an unknown error.`;
    notify(displayMessage, "error", options);
  }
};
