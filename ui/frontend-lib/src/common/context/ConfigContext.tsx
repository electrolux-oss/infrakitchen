import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from "react";

import { useEffectOnce } from "react-use";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";
import { notifyError } from "../hooks/useNotification";

interface ConfigContextType {
  linkPrefix: string;
  ikApi: InfraKitchenApi;
  webSocketEnabled?: boolean;
  entities?: string[];
}

interface GlobalConfigType {
  [key: string]: any;
}

export const ConfigContext = createContext<
  (ConfigContextType & GlobalConfigType) | undefined
>(undefined);

export const ConfigProvider = ({
  children,
  initialLinkPrefix = "/",
  initialIkApi,
  webSocketEnabled = true,
}: {
  children: ReactNode;
  initialLinkPrefix?: string;
  initialIkApi: InfraKitchenApi | any;
  webSocketEnabled?: boolean;
}) => {
  const [globalConfig, setGlobalConfig] = useState<GlobalConfigType>({});

  const [config, setConfig] = useState<ConfigContextType & GlobalConfigType>({
    linkPrefix: initialLinkPrefix,
    ikApi: initialIkApi,
    webSocketEnabled,
    globalConfig: globalConfig,
  });

  const getGlobalConfig = useCallback(async (): Promise<any> => {
    config.ikApi
      .graphqlRequest<{ globalConfig: GlobalConfigType; entities: string[] }>(
        `{
          globalConfig {
            approvalFlow
            demoMode
            websocket
            cloudProviderRegistry
            gitProviderRegistry
            notificationProviderRegistry
            storageProviderRegistry
            secretProviderRegistry
          }
          entities
        }`,
      )
      .then((response) => {
        const gql = response.globalConfig;
        setGlobalConfig({
          approval_flow: gql.approvalFlow,
          demo_mode: gql.demoMode,
          websocket: gql.websocket,
          cloud_provider_registry: gql.cloudProviderRegistry,
          git_provider_registry: gql.gitProviderRegistry,
          storage_provider_registry: gql.storageProviderRegistry,
          secret_provider_registry: gql.secretProviderRegistry,
          entities: response.entities,
        });
      })
      .catch((error: any) => {
        notifyError(error);
      });
  }, [config.ikApi]);

  useEffectOnce(() => {
    getGlobalConfig();
  });

  useEffect(() => {
    setConfig((prevConfig) => ({
      ...prevConfig,
      globalConfig: globalConfig,
    }));
  }, [globalConfig]);

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
