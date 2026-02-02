import { useParams } from "react-router";

import { EntityProvider } from "../../common";
import { ActivityContainer } from "../../common/components/ActivityContainer";

export const BatchOperationActivityPage = () => {
  const { batch_operation_id } = useParams();

  return (
    <EntityProvider
      entity_name="batch_operation"
      entity_id={batch_operation_id || ""}
    >
      <ActivityContainer tabs={["audit"]} />
    </EntityProvider>
  );
};

BatchOperationActivityPage.path =
  "/batch_operations/:batch_operation_id/activity";
