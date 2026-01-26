import { createContext, useContext, useState, ReactNode } from "react";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";

interface ConfigContextType {
  linkPrefix: string;
  ikApi: InfraKitchenApi;
  webSocketUrl: string;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(
  undefined,
);

export const ConfigProvider = ({
  children,
  initialLinkPrefix = "/",
  initialIkApi,
  webSocketUrl = "/api/ws",
}: {
  children: ReactNode;
  initialLinkPrefix?: string;
  initialIkApi: InfraKitchenApi | any;
  webSocketUrl: string;
}) => {
  const [config] = useState<ConfigContextType>({
    linkPrefix: initialLinkPrefix,
    ikApi: initialIkApi,
    webSocketUrl,
  });

  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
};
