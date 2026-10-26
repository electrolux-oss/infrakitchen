import { useNavigate } from "react-router";

import { toast } from "sonner";

import { ApiClientError } from "../../errors";
import { Button } from "../../ui";
import { SnackbarVariant, DependencyError } from "../components/notifications";
import { DefaultError } from "../components/notifications/DefaultError";

const NotifyLinkButton = ({
  to,
  label,
  onClick,
}: {
  to: string;
  label: string;
  onClick?: () => void;
}) => {
  const navigate = useNavigate();
  return (
    <Button
      className="ml-auto min-w-20 px-4 text-[0.85rem] font-semibold whitespace-nowrap text-inherit underline hover:bg-transparent hover:underline"
      variant="text"
      onClick={() => {
        toast.dismiss();
        onClick?.();
        navigate(to);
      }}
    >
      {label}
    </Button>
  );
};

interface NotifyLink {
  to: string;
  label?: string;
  onClick?: () => void;
}

interface NotifyOptions {
  duration?: number;
  link?: NotifyLink;
  description?: string;
  id?: string | number;
}

function getMessage(message: any) {
  if (typeof message === "string") {
    return message;
  }
  try {
    return JSON.stringify(message, null, 2);
  } catch {
    return String(message);
  }
}

const hasErrorDetails = (metadata: ApiClientError["metadata"] | undefined) => {
  if (Array.isArray(metadata)) {
    return metadata.length > 0;
  }

  return Boolean(metadata && Object.keys(metadata).length > 0);
};

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
  const action = options?.link ? (
    <NotifyLinkButton
      to={options.link.to}
      label={options.link.label ?? "View"}
      onClick={options.link.onClick}
    />
  ) : undefined;
  toastForVariant(variant)(messageStr, {
    duration: options?.duration ?? 5000,
    toasterId: "global",
    action,
    description: options?.description,
    id: options?.id,
  });
};

export const notifyError = (error: unknown, options?: NotifyOptions) => {
  const toastOptions = {
    duration: options?.duration ?? Infinity,
    toasterId: "errors" as const,
    id: options?.id,
  };

  if (error instanceof ApiClientError) {
    const displayTitle = `Request failed (${error.status})`;
    const showDetailedToast = hasErrorDetails(error.metadata);

    if (error.error_code === "DEPENDENCY_ERROR" && showDetailedToast) {
      toast.custom(
        (id) => (
          <DependencyError
            id={id}
            title={`${error.status} ${getMessage(error.message)}`}
            metadata={error.metadata}
          />
        ),
        toastOptions,
      );
      return;
    }

    toast.custom(
      (id) => (
        <DefaultError
          id={id}
          title={displayTitle}
          details={getMessage(error.message)}
          metadata={showDetailedToast ? error.metadata : undefined}
        />
      ),
      toastOptions,
    );
    return;
  }

  if (error instanceof Error) {
    toast.custom(
      (id) => (
        <DefaultError
          id={id}
          title="Error"
          metadata={{ message: error.message }}
        />
      ),
      toastOptions,
    );
    return;
  }

  toast.custom(
    (id) => (
      <DefaultError
        id={id}
        title="Error"
        metadata={{ message: "Request failed due to an unknown error." }}
      />
    ),
    toastOptions,
  );
};
