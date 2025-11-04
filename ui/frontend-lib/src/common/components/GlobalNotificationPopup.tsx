import { useEffect, useRef } from "react";

import { useNotificationProvider } from "../context/NotificationContext";
import { notify } from "../hooks/useNotification";

export const GlobalNotificationPopup = () => {
  const { notification } = useNotificationProvider();
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

    const title = notificationData.title;
    const body =
      notificationData.message ||
      notificationData.msg ||
      "Notification received";

    const finalMessage = title && title !== body ? `${title}: ${body}` : body;

    notify(finalMessage, severity, {
      autoHideDuration: 8000,
      preventDuplicate: false,
    });
  }, [notification]);

  return null;
};
