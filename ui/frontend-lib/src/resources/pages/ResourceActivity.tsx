import { useParams } from "react-router";

import { EntityProvider } from "../../common";
import { ActivityContainer } from "../../common/components/ActivityContainer";

export const ResourceActivityPage = () => {
  const { resource_id } = useParams();

  return (
    <EntityProvider entity_name="resource" entity_id={resource_id || ""}>
      <ActivityContainer tabs={["audit", "logs", "revisions"]} />
    </EntityProvider>
  );
};

ResourceActivityPage.path = "/resources/:resource_id/activity";
