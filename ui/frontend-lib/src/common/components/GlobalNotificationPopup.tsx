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

    const sourceId = [
      notification.status,
      notification.title,
      notification.msg,
      notification.entityName,
      notification.entityId,
    ]
      .filter(Boolean)
      .join("|");
    if (sourceId === lastSourceId.current) return; // simple dedupe
    lastSourceId.current = sourceId;

    const severity = (notification.status || "info") as
      | "default"
      | "error"
      | "success"
      | "warning"
      | "info";

    const title: string | undefined = notification.title ?? undefined;
    const body: string = notification.msg || "Notification received";

    const entityName: string | undefined = notification.entityName ?? undefined;
    const entityId: string | undefined = notification.entityId ?? undefined;
    const segment = entityName ? ENTITY_PATHS[entityName] : undefined;
    const link =
      segment && entityId
        ? {
            to: `${linkPrefix}${segment}/${entityId}`,
            label: ENTITY_LABELS[entityName!] ?? "View",
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
