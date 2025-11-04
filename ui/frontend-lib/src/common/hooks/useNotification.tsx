import { enqueueSnackbar, SnackbarKey } from "notistack";

import { ApiClientError } from "../../errors";
import {
  SnackbarVariant,
  NotificationContent,
  DependencyError,
} from "../components/notifications";

interface NotifyOptions {
  persist?: boolean;
  autoHideDuration?: number | null;
  anchorOrigin?: {
    vertical: "top" | "bottom";
    horizontal: "left" | "center" | "right";
  };
  preventDuplicate?: boolean;
}

export const notify = (
  message: string,
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
    displayMessage = `${error.status} ${error.message}`;
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
