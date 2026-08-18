import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";

import { useEffectOnce } from "react-use";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";
import { GqlUserShort, USER_SHORT_FIELDS } from "../../users/graphql";
import { notifyError } from "../hooks/useNotification";

export interface ServerInfo {
  version: string;
  versionUrl: string;
  repository: string;
  repositoryUrl: string;
  sourceCommit: string;
  sourceCommitShort: string;
  sourceUrl: string;
  python: string;
  hostMetadata: Record<string, string>;
}

interface ConfigContextType {
  linkPrefix: string;
  ikApi: InfraKitchenApi;
  webSocketEnabled?: boolean;
  entities?: string[];
  bootstrapPermissions?: Record<string, string>;
  bootstrapLoading?: boolean;
  bootstrapError?: string | null;
  serverInfo?: ServerInfo | null;
  serverInfoLoading?: boolean;
  serverInfoError?: string | null;
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
  initialIkApi: InfraKitchenApi;
  webSocketEnabled?: boolean;
}) => {
  const [config, setConfig] = useState<ConfigContextType & GlobalConfigType>({
    linkPrefix: initialLinkPrefix,
    ikApi: initialIkApi,
    webSocketEnabled,
    globalConfig: {},
    bootstrapPermissions: {},
    bootstrapLoading: true,
    bootstrapError: null,
    serverInfo: null,
    serverInfoLoading: true,
    serverInfoError: null,
  });

  const getBootstrapConfig = useCallback(async (): Promise<void> => {
    try {
      const response = await initialIkApi.graphqlRequest<{
        globalConfig: GlobalConfigType;
        entities: string[];
        userApiPolicies: Record<string, string>;
        currentUser: GqlUserShort | null;
        serverInfo: ServerInfo;
      }>(
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
          userApiPolicies
          currentUser {
            ${USER_SHORT_FIELDS}
          }
          serverInfo {
            version
            versionUrl
            repository
            repositoryUrl
            sourceCommit
            sourceCommitShort
            sourceUrl
            python
            hostMetadata
          }
        }`,
      );

      const gql = response.globalConfig;
      const mappedGlobalConfig = {
        approval_flow: gql.approvalFlow,
        demo_mode: gql.demoMode,
        websocket: gql.websocket,
        cloud_provider_registry: gql.cloudProviderRegistry,
        git_provider_registry: gql.gitProviderRegistry,
        storage_provider_registry: gql.storageProviderRegistry,
        secret_provider_registry: gql.secretProviderRegistry,
        entities: response.entities,
      };

      setConfig((prevConfig) => ({
        ...prevConfig,
        entities: response.entities,
        globalConfig: mappedGlobalConfig,
        bootstrapPermissions: response.userApiPolicies || {},
        bootstrapLoading: false,
        bootstrapError: null,
        currentUser: response.currentUser,
        serverInfo: response.serverInfo,
        serverInfoLoading: false,
        serverInfoError: null,
      }));
    } catch (error: any) {
      notifyError(error);
      setConfig((prevConfig) => ({
        ...prevConfig,
        bootstrapLoading: false,
        bootstrapError: error?.message || "Failed to load bootstrap config",
        serverInfoLoading: false,
        serverInfoError: error?.message || "Failed to load server info",
      }));
    }
  }, [initialIkApi]);

  useEffectOnce(() => {
    getBootstrapConfig();
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
