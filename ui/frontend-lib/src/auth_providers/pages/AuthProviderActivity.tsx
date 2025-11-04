import { useParams } from "react-router";

import { ActivityContainer } from "../../common/components/ActivityContainer";
import { EntityProvider } from "../../common/context/EntityContext";

export const AuthProviderActivityPage = () => {
  const { auth_provider_id } = useParams();

  return (
    <EntityProvider
      entity_name="auth_provider"
      entity_id={auth_provider_id || ""}
    >
      <ActivityContainer tabs={["audit"]} />
    </EntityProvider>
  );
};

AuthProviderActivityPage.path = "/auth_providers/:auth_provider_id/activity";
