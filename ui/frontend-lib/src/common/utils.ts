import { ENTITY_STATE, ENTITY_STATUS, WORKER_STATUS } from "../utils";

export const getStateColor = (
  statusValue: string,
  stateValue: string | undefined,
): { backgroundColor: string; color: string; borderColor: string } => {
  const status = statusValue as ENTITY_STATUS | WORKER_STATUS;
  const state = stateValue as ENTITY_STATE;

  if (status === ENTITY_STATUS.DONE && state === ENTITY_STATE.PROVISIONED)
    return {
      backgroundColor: "success.main",
      color: "success.text",
      borderColor: "success.main",
    };

  if (status === ENTITY_STATUS.DONE && state === ENTITY_STATE.DESTROYED)
    return {
      backgroundColor: "grey.200",
      color: "text.primary",
      borderColor: "grey.300",
    };

  if (status === ENTITY_STATUS.DONE || status === ENTITY_STATUS.ENABLED)
    return {
      backgroundColor: "success.main",
      color: "success.text",
      borderColor: "success.main",
    };

  if (
    status === ENTITY_STATUS.APPROVAL_PENDING ||
    status === ENTITY_STATUS.READY
  )
    return {
      backgroundColor: "warning.main",
      color: "warning.text",
      borderColor: "warning.main",
    };

  if (status === ENTITY_STATUS.ERROR)
    return {
      backgroundColor: "error.main",
      color: "error.text",
      borderColor: "error.main",
    };

  if (status === ENTITY_STATUS.UNKNOWN || status === ENTITY_STATUS.QUEUED)
    return {
      backgroundColor: "grey.200",
      color: "text.primary",
      borderColor: "grey.300",
    };

  if (status === ENTITY_STATUS.IN_PROGRESS)
    return {
      backgroundColor: "info.dark",
      color: "primary.contrastText",
      borderColor: "info.dark",
    };

  if (status === WORKER_STATUS.BUSY)
    return {
      backgroundColor: "info.dark",
      color: "primary.contrastText",
      borderColor: "info.dark",
    };

  if (status === WORKER_STATUS.FREE)
    return {
      backgroundColor: "success.main",
      color: "success.text",
      borderColor: "success.main",
    };

  return {
    backgroundColor: "grey.200",
    color: "text.primary",
    borderColor: "grey.300",
  };
};

export const formatTimeAgo = (dateInput: string | Date) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  if (isNaN(date.getTime())) {
    return "Invalid date";
  }

  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return "Just now";

  if (diffInMinutes < 60)
    return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;

  if (diffInHours < 24)
    return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;

  if (diffInDays === 1) return "1 day ago";

  if (diffInDays < 7) return `${diffInDays} days ago`;

  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }

  if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }

  const years = Math.floor(diffInDays / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
};

export const getProviderFromLabels = (labels: string[]) => {
  const providerLabel = labels.find((l) => l.startsWith("cloud:"));
  return providerLabel ? providerLabel.replace("cloud:", "") : "unknown";
};

export const getCategoryFromLabels = (labels: string[]) => {
  const label = labels.find((l) => l.startsWith("type:"));
  return label ? label.replace("type:", "") : "general";
};

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  github: "GitHub",
  github_ssh: "GitHub",
  bitbucket: "Bitbucket",
  bitbucket_ssh: "Bitbucket",
  aws: "AWS",
  gcp: "Google Cloud",
  mongodb_atlas: "MongoDB Atlas",
  azurerm: "Azure",
  azure_devops: "Azure Repos",
  azure_devops_ssh: "Azure Repos",
  datadog: "Datadog",
};

export const getProviderDisplayName = (provider: string): string => {
  const lowerProvider = provider.toLowerCase();
  return (
    PROVIDER_DISPLAY_NAMES[lowerProvider] ||
    provider.charAt(0).toUpperCase() + provider.slice(1)
  );
};

export const getRepoNameFromUrl = (repoUrl: string): string => {
  try {
    const url = new URL(repoUrl);
    return url.pathname.split("/").pop() || "Unknown Repository";
  } catch {
    return repoUrl;
  }
};

export const formatLabel = (key: string): string => {
  return key
    .split("_")
    .map((word) => {
      const lowerWord = word.toLowerCase();
      if (lowerWord === "id") return "ID";
      if (lowerWord === "ssh") return "SSH";

      if (PROVIDER_DISPLAY_NAMES[lowerWord]) {
        return PROVIDER_DISPLAY_NAMES[lowerWord];
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};
