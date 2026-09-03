import { formatLabel } from "../../common";
import { CommonField } from "../../common/components/CommonField";
import { BaseCard } from "../../common/components/BaseCard";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { GqlAuthProvider } from "../graphql";

import { AuthProviderConfigurationEditor } from "./AuthProviderConfigurationEditor";

export interface AuthProviderConfigurationProps {
  authProvider: GqlAuthProvider;
}

export const AuthProviderConfiguration = ({
  authProvider,
}: AuthProviderConfigurationProps) => {
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:auth_provider", "write");

  return (
    <BaseCard name="Auth Provider Configuration">
      <AuthProviderConfigurationEditor
        authProvider={authProvider}
        canEdit={canEdit}
      />
      <CommonField
        name={"Auth Provider Type"}
        value={authProvider.authProvider}
      />
      {Object.entries(authProvider.configuration || {})
        .filter(([k]) => k !== "auth_provider")
        .map(([k, v]) => {
          // Mask secret values
          const displayValue =
            typeof v === "string" && k.toLowerCase().includes("secret")
              ? "********"
              : v;
          return (
            <CommonField
              key={`${k}${v}`}
              name={formatLabel(k)}
              value={displayValue}
            />
          );
        })}
    </BaseCard>
  );
};
