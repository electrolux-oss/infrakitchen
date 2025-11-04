import { useParams } from "react-router";

import { ActivityContainer } from "../../common/components/ActivityContainer";
import { EntityProvider } from "../../common/context/EntityContext";

export const StorageActivityPage = () => {
  const { storage_id } = useParams();

  return (
    <EntityProvider entity_name="storage" entity_id={storage_id || ""}>
      <ActivityContainer tabs={["audit", "logs", "revisions"]} />
    </EntityProvider>
  );
};

StorageActivityPage.path = "/storages/:storage_id/activity";
