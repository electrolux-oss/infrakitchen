import { useParams } from "react-router";

import { ActivityContainer } from "../../common/components/ActivityContainer";
import { EntityProvider } from "../../common/context/EntityContext";

export const SecretActivityPage = () => {
  const { secret_id } = useParams();

  return (
    <EntityProvider entity_name="secret" entity_id={secret_id || ""}>
      <ActivityContainer tabs={["audit", "revisions"]} />
    </EntityProvider>
  );
};

SecretActivityPage.path = "/secrets/:secret_id/activity";
