import { useEffect, useRef } from "react";

import { useConfig } from "../context/ConfigContext";
import { useNotificationProvider } from "../context/NotificationContext";
import { notify } from "../hooks/useNotification";

const ENTITY_PATHS: Record<string, string> = {
  resource: "resources",
  workspace: "workspaces",
  storage: "storages",
  executor: "executors",
  source_code: "source_codes",
  secret: "secrets",
  template: "templates",
  integration: "integrations",
  auth_provider: "auth_providers",
};

const ENTITY_LABELS: Record<string, string> = {
  resource: "View resource",
  workspace: "View workspace",
  storage: "View storage",
  executor: "View executor",
  source_code: "View source code",
  secret: "View secret",
  template: "View template",
  integration: "View integration",
  auth_provider: "View auth provider",
};

export const GlobalNotificationPopup = () => {
  const { notification } = useNotificationProvider();
  const { linkPrefix } = useConfig();
  const lastSourceId = useRef<string | null>(null);

  useEffect(() => {
    if (!notification) return;

    let notificationData: any = notification;
    if (notification.msg && typeof notification.msg === "string") {
      notificationData = {
        id: notification.id || Date.now().toString(),
        message: notification.msg,
        type: notification.type || "info",
        title: notification.title,
        entity_id: notification.entity_id,
        entity_name: notification.entity_name,
      };
    }

    const sourceId = notificationData.id || Date.now().toString();
    if (sourceId === lastSourceId.current) return; // simple dedupe
    lastSourceId.current = sourceId;

    const severity = (notificationData.type || "info") as
      | "default"
      | "error"
      | "success"
      | "warning"
      | "info";

    const title: string | undefined = notificationData.title;
    const body: string =
      notificationData.message ||
      notificationData.msg ||
      "Notification received";

    const entityName: string | undefined = notificationData.entity_name;
    const entityId: string | undefined = notificationData.entity_id;
    const action: string | undefined = notificationData.action;
    const segment = entityName ? ENTITY_PATHS[entityName] : undefined;
    const isFailure = severity === "error" || severity === "warning";
    const link =
      segment && entityId
        ? isFailure
          ? {
              to: `${linkPrefix}${segment}/${entityId}/logs`,
              label: "View logs",
            }
          : {
              to: `${linkPrefix}${segment}/${entityId}`,
              label: action
                ? `View ${action} ${(entityName ?? "").replace(/_/g, " ")}`.trim()
                : (ENTITY_LABELS[entityName!] ?? "View"),
            }
        : undefined;

    const headline = title && title.trim() ? title : body;
    const description =
      title && title.trim() && title !== body ? body : undefined;
    const toastId =
      entityName && entityId ? `entity:${entityName}:${entityId}` : undefined;

    notify(headline, severity, {
      duration: 8000,
      link,
      description,
      id: toastId,
    });
  }, [notification, linkPrefix]);

  return null;
};
