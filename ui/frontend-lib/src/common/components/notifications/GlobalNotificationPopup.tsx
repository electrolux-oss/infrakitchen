import { useEffect, useRef } from "react";

import { useConfig } from "../../context/ConfigContext";
import { useNotificationProvider } from "../../context/NotificationContext";
import { notify, notifyError } from "../../hooks/useNotification";

import { getNotificationEntityLink } from "./notificationLinks";

export const GlobalNotificationPopup = () => {
  const { notification, markNotificationsRead } = useNotificationProvider();
  const { linkPrefix } = useConfig();
  const lastSourceId = useRef<string | null>(null);

  useEffect(() => {
    if (!notification) return;

    const sourceId =
      notification.id ??
      [
        notification.status,
        notification.title,
        notification.msg,
        notification.entityType,
        notification.entityId,
      ]
        .filter(Boolean)
        .join("|");
    if (sourceId === lastSourceId.current) return; // simple dedupe
    lastSourceId.current = sourceId;

    const severity = (notification.status || "info") as
      "default" | "error" | "success" | "warning" | "info";

    const title: string | undefined = notification.title ?? undefined;
    const body: string = notification.msg || "Notification received";

    const entityType: string | undefined = notification.entityType ?? undefined;
    const entityId: string | undefined = notification.entityId ?? undefined;
    const entityLink = getNotificationEntityLink(
      linkPrefix,
      entityType,
      entityId,
    );
    const notificationId = notification.id;
    const link =
      entityLink && notificationId
        ? {
            ...entityLink,
            onClick: () =>
              markNotificationsRead([notificationId]).catch(notifyError),
          }
        : entityLink;

    const headline = title && title.trim() ? title : body;
    const description =
      title && title.trim() && title !== body ? body : undefined;
    const toastId =
      entityType && entityId ? `entity:${entityType}:${entityId}` : undefined;

    notify(headline, severity, {
      duration: 8000,
      link,
      description,
      id: toastId,
    });
  }, [notification, linkPrefix, markNotificationsRead]);

  return null;
};
