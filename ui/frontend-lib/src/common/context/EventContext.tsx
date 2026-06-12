import { createContext, useContext, useState, ReactNode } from "react";

import { useEventStreamSubscription } from "../hooks/useEventStreamSubscription";

import { useConfig } from "./ConfigContext";

interface EventContextType {
  event: any;
}

export const EventContext = createContext<EventContextType | undefined>(
  undefined,
);

export const EventProvider = ({ children }: { children: ReactNode }) => {
  const [event, setEvent] = useState<any>();
  const { ikApi, webSocketEnabled, globalConfig } = useConfig();

  const subscriptionEnabled = !!webSocketEnabled && !!globalConfig?.websocket;

  useEventStreamSubscription({
    ikApi,
    enabled: subscriptionEnabled,
    onMessage: (data) => {
      setEvent(data.payload);
    },
  });

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
