import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { AuthProviderContent } from "../components/AuthProviderContent";
import { AUTH_PROVIDER_FIELDS, transformAuthProvider } from "../graphql";

export const AuthProviderPage = () => {
  const { auth_provider_id } = useParams();

  return (
    <EntityProvider
      entity_name="authProvider"
      entity_id={auth_provider_id || ""}
      entityFields={AUTH_PROVIDER_FIELDS}
      transformFn={transformAuthProvider}
    >
      <EntityContainer title={"Auth Provider Overview"} hideEditAction>
        <AuthProviderContent />
      </EntityContainer>
    </EntityProvider>
  );
};

AuthProviderPage.path = "/auth_providers/:auth_provider_id/:tab?";
