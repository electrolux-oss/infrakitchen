import { createContext, useContext, useRef, useState, ReactNode } from "react";

import { flushSync } from "react-dom";

import { useEventStreamSubscription } from "../hooks/useEventStreamSubscription";

import { useConfig } from "./ConfigContext";

// Sent by the server when its own listener reconnected and may have lost events
const EVENTS_RESYNC = "events_resync";

interface EventContextType {
  event: any;
  /**
   * Goes up whenever events may have been lost (the websocket reconnected, or the
   * server lost its event feed for a while). Views kept live by events reload then.
   */
  resyncVersion: number;
}

export const EventContext = createContext<EventContextType | undefined>(
  undefined,
);

export const EventProvider = ({ children }: { children: ReactNode }) => {
  const [event, setEvent] = useState<any>();
  const [resyncVersion, setResyncVersion] = useState(0);
  const connectedBefore = useRef(false);
  const { ikApi, webSocketEnabled, globalConfig } = useConfig();

  const subscriptionEnabled = !!webSocketEnabled && !!globalConfig?.websocket;

  useEventStreamSubscription({
    ikApi,
    enabled: subscriptionEnabled,
    onConnected: () => {
      // The first connect has nothing to catch up on: views load after it anyway
      if (connectedBefore.current) setResyncVersion((prev) => prev + 1);
      connectedBefore.current = true;
    },
    onMessage: (data) => {
      if (data.event === EVENTS_RESYNC) {
        setResyncVersion((prev) => prev + 1);
        return;
      }
      // Consumers react to `event` in effects: commit each event on its own, otherwise
      // events arriving back to back are batched and only the last one is seen
      flushSync(() => setEvent(data.payload));
    },
  });

  const contextValue: EventContextType = {
    event,
    resyncVersion,
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
