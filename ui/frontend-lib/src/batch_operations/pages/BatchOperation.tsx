import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { BatchOperationContent } from "../components/BatchOperationContent";

export const BatchOperationPage = () => {
  const { batch_operation_id } = useParams<{ batch_operation_id: string }>();

  return (
    <EntityProvider
      entity_name="batch_operation"
      entity_id={batch_operation_id || ""}
    >
      <EntityContainer title={"Batch Operation Overview"} showActivity={false}>
        <BatchOperationContent />
      </EntityContainer>
    </EntityProvider>
  );
};

BatchOperationPage.path = "/batch_operations/:batch_operation_id/:tab?";
