import { formatLabel } from "../../common";
import { CommonField } from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { AuthProviderResponse } from "../types";

import { AuthProviderConfigurationEditor } from "./AuthProviderConfigurationEditor";

export interface AuthProviderConfigurationProps {
  authProvider: AuthProviderResponse;
}

export const AuthProviderConfiguration = ({
  authProvider,
}: AuthProviderConfigurationProps) => {
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:auth_provider", "write");

  return (
    <OverviewCard name="Auth Provider Configuration">
      <AuthProviderConfigurationEditor
        authProvider={authProvider}
        canEdit={canEdit}
      />
      <CommonField
        name={"Auth Provider Type"}
        value={authProvider.authProvider}
      />
      {Object.entries(authProvider.configuration)
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
    </OverviewCard>
  );
};
