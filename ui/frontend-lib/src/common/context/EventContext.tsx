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

interface EventContextType {
  event: any;
}

export const EventContext = createContext<EventContextType | undefined>(
  undefined,
);

export const EventProvider = ({ children }: { children: ReactNode }) => {
  const [event, setEvent] = useState<any>();
  const { ikApi, webSocketUrl } = useConfig();

  const socketManagerRef = useRef<WebSocketManager | null>(null);

  useEffect(() => {
    if (socketManagerRef.current === null) {
      socketManagerRef.current = new WebSocketManager(
        ikApi,
        webSocketUrl,
        "/events",
      );
    }
  }, [ikApi, webSocketUrl]);

  useEffect(() => {
    if (socketManagerRef.current) {
      socketManagerRef.current.setEventHandler((messageEvent) => {
        const data = JSON.parse(messageEvent.data);
        setEvent(data);
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
  }, [setEvent]);

  const contextValue: EventContextType = {
    event,
  };

  return (
    <EventContext.Provider value={contextValue}>
      {children}
    </EventContext.Provider>
  );
};

export const useEventProvider = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEventProvider must be used within an EventProvider");
  }
  return context;
};
