import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";

import {
  GqlUserNotification,
  MARK_ALL_USER_NOTIFICATIONS_READ_MUTATION,
  MARK_USER_NOTIFICATIONS_READ_MUTATION,
  MARK_USER_NOTIFICATIONS_UNREAD_MUTATION,
  RECENT_USER_NOTIFICATIONS_QUERY,
} from "../../notifications/graphql";
import { notifyError } from "../hooks/useNotification";
import {
  NotificationMessage,
  useNotificationSubscription,
} from "../hooks/useNotificationSubscription";

import { useConfig } from "./ConfigContext";

const RECENT_NOTIFICATIONS_LIMIT = 10;

interface NotificationContextType {
  notification: NotificationMessage | undefined;
  unreadCount: number;
  recentNotifications: GqlUserNotification[];
  refreshNotifications: () => Promise<void>;
  markNotificationsRead: (ids: string[]) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  toggleNotificationRead: (notification: GqlUserNotification) => Promise<void>;
}

export const NotificationContext = createContext<
  NotificationContextType | undefined
>(undefined);

const toUserNotification = (
  message: NotificationMessage,
): GqlUserNotification | undefined => {
  if (!message.id) return undefined;
  return {
    id: message.id,
    eventType: message.eventType ?? "",
    entityType: message.entityType ?? "",
    entityId: message.entityId,
    entityName: message.entityName,
    title: message.title,
    message: message.msg,
    status: message.status,
    readAt: null,
    createdAt: message.createdAt ?? new Date().toISOString(),
  };
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notification, setNotification] = useState<
    NotificationMessage | undefined
  >();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<
    GqlUserNotification[]
  >([]);
  const { ikApi, webSocketEnabled, globalConfig } = useConfig();

  const refreshNotifications = useCallback(async () => {
    try {
      const response = await ikApi.graphqlRequest<{
        userNotifications: GqlUserNotification[];
        unreadUserNotificationsCount: number;
      }>(RECENT_USER_NOTIFICATIONS_QUERY, {
        range: [0, RECENT_NOTIFICATIONS_LIMIT],
      });
      setRecentNotifications(response?.userNotifications ?? []);
      setUnreadCount(response?.unreadUserNotificationsCount ?? 0);
    } catch (error) {
      notifyError(error);
    }
  }, [ikApi]);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const markNotificationsRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      await ikApi.graphqlRequest(MARK_USER_NOTIFICATIONS_READ_MUTATION, {
        ids,
      });
      await refreshNotifications();
    },
    [ikApi, refreshNotifications],
  );

  const markAllNotificationsRead = useCallback(async () => {
    await ikApi.graphqlRequest(MARK_ALL_USER_NOTIFICATIONS_READ_MUTATION);
    await refreshNotifications();
  }, [ikApi, refreshNotifications]);

  const toggleNotificationRead = useCallback(
    async (target: GqlUserNotification) => {
      await ikApi.graphqlRequest(
        target.readAt
          ? MARK_USER_NOTIFICATIONS_UNREAD_MUTATION
          : MARK_USER_NOTIFICATIONS_READ_MUTATION,
        { ids: [target.id] },
      );
      await refreshNotifications();
    },
    [ikApi, refreshNotifications],
  );

  const handleMessage = useCallback((data: NotificationMessage) => {
    setNotification(data);
    const received = toUserNotification(data);
    if (!received) return;
    setRecentNotifications((previous) =>
      [received, ...previous.filter((n) => n.id !== received.id)].slice(
        0,
        RECENT_NOTIFICATIONS_LIMIT,
      ),
    );
    setUnreadCount((previous) => previous + 1);
  }, []);

  const subscriptionEnabled = !!webSocketEnabled && !!globalConfig?.websocket;

  useNotificationSubscription({
    ikApi,
    enabled: subscriptionEnabled,
    onMessage: handleMessage,
  });

  const contextValue: NotificationContextType = {
    notification,
    unreadCount,
    recentNotifications,
    refreshNotifications,
    markNotificationsRead,
    markAllNotificationsRead,
    toggleNotificationRead,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationProvider = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationProvider must be used within a NotificationProvider",
    );
  }
  return context;
};
