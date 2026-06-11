import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";

import {
  NotificationMessage,
  useNotificationSubscription,
} from "../hooks/useNotificationSubscription";

import { useConfig } from "./ConfigContext";

interface NotificationContextType {
  notification: NotificationMessage | undefined;
}

export const NotificationContext = createContext<
  NotificationContextType | undefined
>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notification, setNotification] = useState<
    NotificationMessage | undefined
  >();
  const { ikApi, webSocketEnabled, globalConfig } = useConfig();

  const handleMessage = useCallback((data: NotificationMessage) => {
    setNotification(data);
  }, []);

  const subscriptionEnabled = !!webSocketEnabled && !!globalConfig?.websocket;

  useNotificationSubscription({
    ikApi,
    enabled: subscriptionEnabled,
    onMessage: handleMessage,
  });

  const contextValue: NotificationContextType = {
    notification,
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
