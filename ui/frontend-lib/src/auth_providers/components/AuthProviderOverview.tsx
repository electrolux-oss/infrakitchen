import {
  CommonField,
  getBooleanLabel,
  getProviderValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { AuthProviderResponse } from "../types";

interface AuthProviderAboutProps {
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
        value={getProviderValue(authProvider.auth_provider)}
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
