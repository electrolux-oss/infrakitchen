import { createContext, useContext, useState, ReactNode } from "react";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";

interface ConfigContextType {
  linkPrefix: string;
  ikApi: InfraKitchenApi;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(
  undefined,
);

export const ConfigProvider = ({
  children,
  initialLinkPrefix = "/",
  initialIkApi,
}: {
  children: ReactNode;
  initialLinkPrefix?: string;
  initialIkApi: InfraKitchenApi | any;
}) => {
  const [config] = useState<ConfigContextType>({
    linkPrefix: initialLinkPrefix,
    ikApi: initialIkApi,
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
