import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from "react";

import WebSocketManager from "../WebSocketManager";

import { useConfig } from "./ConfigContext";

interface NotificationContextType {
  notification: any;
}

export const NotificationContext = createContext<
  NotificationContextType | undefined
>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notification, setNotification] = useState<any>();
  const { ikApi, webSocketEnabled, globalConfig } = useConfig();

  const socketManagerRef = useRef<WebSocketManager | null>(null);

  useEffect(() => {
    if (
      socketManagerRef.current === null &&
      webSocketEnabled &&
      globalConfig?.websocket
    ) {
      socketManagerRef.current = new WebSocketManager(
        ikApi,
        "/api/ws/notifications",
      );
    }
  }, [ikApi, webSocketEnabled, globalConfig]);

  useEffect(() => {
    if (
      socketManagerRef.current &&
      webSocketEnabled &&
      globalConfig?.websocket
    ) {
      socketManagerRef.current.setEventHandler((messageEvent) => {
        const data = JSON.parse(messageEvent.data);
        setNotification(data);
      });
      socketManagerRef.current.startVisibilityTracking();
      socketManagerRef.current.connect();
    }
    return () => {
      if (socketManagerRef.current) {
        socketManagerRef.current.stopVisibilityTracking();
        socketManagerRef.current.disconnect();
      }
    };
  }, [setNotification, webSocketEnabled, globalConfig]);

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
