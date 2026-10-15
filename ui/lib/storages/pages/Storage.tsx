import { useParams } from "react-router";

import { LogLiveTail } from "../../common";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { TASK_QUEUE_STATUS_SELECTION } from "../../workers/graphql";
import { StorageContent } from "../components/StorageContent";
import { STORAGE_DETAIL_FIELDS } from "../graphql";

// Queue state is fetched with the entity in the same request
const PAGE_FIELDS = `${STORAGE_DETAIL_FIELDS}${TASK_QUEUE_STATUS_SELECTION}`;

export const StoragePage = () => {
  const { storage_id } = useParams();

  return (
    <EntityProvider
      entity_name="storage"
      entity_id={storage_id || ""}
      entityFields={PAGE_FIELDS}
    >
      <EntityContainer title={"Storage Details"}>
        <StorageContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

StoragePage.path = "/storages/:storage_id/:tab?";
