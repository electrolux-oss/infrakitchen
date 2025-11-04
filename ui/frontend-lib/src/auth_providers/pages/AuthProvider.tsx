import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { AuthProviderContent } from "../components/AuthProvderContent";

export const AuthProviderPage = () => {
  const { auth_provider_id } = useParams();

  return (
    <EntityProvider
      entity_name="auth_provider"
      entity_id={auth_provider_id || ""}
    >
      <EntityContainer title={"Auth Provider Overview"}>
        <AuthProviderContent />
      </EntityContainer>
    </EntityProvider>
  );
};

AuthProviderPage.path = "/auth_providers/:auth_provider_id";
