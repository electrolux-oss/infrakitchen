import { useParams } from "react-router";

import { CreatePrefillState, LogLiveTail } from "../../common";
import { CreateMenuButton } from "../../common/components/buttons/CreateMenuButton";
import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { entityIcons } from "../../common/components/entities/entityIcons";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { ENTITY_STATE } from "../../utils";
import { TASK_QUEUE_STATUS_SELECTION } from "../../workers/graphql";
import { StorageContent } from "../components/StorageContent";
import { STORAGE_DETAIL_FIELDS } from "../graphql";

// Queue state is fetched with the entity in the same request
const PAGE_FIELDS = `${STORAGE_DETAIL_FIELDS}${TASK_QUEUE_STATUS_SELECTION}`;

/**
 * Shortcuts for creating a resource or executor that keeps its state in this
 * storage. The storage's integration is preselected too, because the storage
 * pickers only list cloud storages whose integration is selected. Hidden until
 * the storage is provisioned, since the pickers can't select it before then.
 */
const StorageCreateActions = () => {
  const { entity } = useEntityProvider();

  const provisioned =
    String(entity?.state ?? "").toLowerCase() === ENTITY_STATE.PROVISIONED;
  if (!entity?.id || !provisioned) return null;
  const state: CreatePrefillState = {
    storage_id: entity.id,
    integration_ids: entity.integration?.id ? [entity.integration.id] : [],
  };

  return (
    <CreateMenuButton
      options={[
        {
          label: "Resource",
          icon: entityIcons.resource,
          path: "resources/create",
          state,
          permission: "api:resource",
        },
        {
          label: "Executor",
          icon: entityIcons.executor,
          path: "executors/create",
          state,
          permission: "api:executor",
        },
      ]}
    />
  );
};

export const StoragePage = () => {
  const { storage_id } = useParams();

  return (
    <EntityProvider
      entity_name="storage"
      entity_id={storage_id || ""}
      entityFields={PAGE_FIELDS}
    >
      <EntityContainer
        titleIcon={entityIcons.storage}
        actions={
          <>
            <StorageCreateActions />
            <EntityRefreshButton />
          </>
        }
      >
        <StorageContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

StoragePage.path = "/storages/:storage_id/:tab?";
