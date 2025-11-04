import { useParams } from "react-router";

import { ActivityContainer } from "../../common/components/ActivityContainer";
import { EntityProvider } from "../../common/context/EntityContext";

export const IntegrationActivityPage = () => {
  const { integration_id } = useParams();

  return (
    <EntityProvider entity_name="integration" entity_id={integration_id || ""}>
      <ActivityContainer tabs={["audit", "revisions"]} />
    </EntityProvider>
  );
};

IntegrationActivityPage.path = "/integrations/:integration_id/activity";
