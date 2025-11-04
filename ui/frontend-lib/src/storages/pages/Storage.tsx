import { useParams } from "react-router";

import { LogLiveTail } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { StorageContent } from "../components/StorageContent";

export const StoragePage = () => {
  const { storage_id } = useParams();

  return (
    <EntityProvider entity_name="storage" entity_id={storage_id || ""}>
      <EntityContainer title={"Storage Overview"}>
        <StorageContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

StoragePage.path = "/storages/:storage_id";
