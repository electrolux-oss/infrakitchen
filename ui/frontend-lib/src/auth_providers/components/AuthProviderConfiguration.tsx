import { formatLabel } from "../../common";
import {
  CommonField,
  getLabels,
  getTextValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { AuthProviderResponse } from "../types";

export interface AuthProviderConfigurationProps {
  auth_provider: AuthProviderResponse;
}

export const AuthProviderConfiguration = ({
  auth_provider,
}: AuthProviderConfigurationProps) => {
  return (
    <OverviewCard name="Auth Provider Configuration">
      <CommonField
        name={"Auth Provider Type"}
        value={getTextValue(auth_provider.auth_provider)}
      />
      <CommonField
        name={"Filter By Domain"}
        value={getLabels(auth_provider.filter_by_domain)}
      />
      {Object.entries(auth_provider.configuration).map(([k, v]) => {
        return <CommonField key={`${k}${v}`} name={formatLabel(k)} value={v} />;
      })}
    </OverviewCard>
  );
};
