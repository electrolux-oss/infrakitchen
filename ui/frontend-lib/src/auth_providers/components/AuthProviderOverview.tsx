import {
  getTextValue,
  CommonField,
  getBooleanLabel,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { AuthProviderResponse } from "../types";

export interface AuthProviderAboutProps {
  authProvider: AuthProviderResponse;
}

export const AuthProviderOverview = ({
  authProvider,
}: AuthProviderAboutProps) => {
  return (
    <OverviewCard
      name={authProvider.name}
      description={authProvider.description}
    >
      <CommonField
        name={"Auth Provider Type"}
        value={getTextValue(authProvider.auth_provider)}
      />
      <CommonField
        name={"Enabled"}
        value={getBooleanLabel(authProvider.enabled)}
      />
      <CommonField
        name={"Created"}
        value={<RelativeTime date={authProvider.created_at} />}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={authProvider.updated_at} />}
      />
    </OverviewCard>
  );
};
