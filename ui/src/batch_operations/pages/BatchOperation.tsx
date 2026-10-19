import { useParams } from "react-router";

import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { HeroQueueListIcon } from "../../icons";
import { BatchOperationContent } from "../components/BatchOperationContent";
import { BATCH_OPERATION_FIELDS } from "../graphql";

export const BatchOperationPage = () => {
  const { batch_operation_id } = useParams<{ batch_operation_id: string }>();

  return (
    <EntityProvider
      entity_name="batchOperation"
      entity_id={batch_operation_id || ""}
      entityFields={BATCH_OPERATION_FIELDS}
    >
      <EntityContainer
        titleIcon={<HeroQueueListIcon />}
        actions={<EntityRefreshButton />}
      >
        <BatchOperationContent />
      </EntityContainer>
    </EntityProvider>
  );
};

BatchOperationPage.path = "/batch_operations/:batch_operation_id/:tab?";
