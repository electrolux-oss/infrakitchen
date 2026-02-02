import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { BatchOperationContent } from "../components/BatchOperationContent";

export const BatchOperationPage = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <EntityProvider entity_name="batch_operation" entity_id={id || ""}>
      <EntityContainer title={"Batch Operation Overview"}>
        <BatchOperationContent />
      </EntityContainer>
    </EntityProvider>
  );
};

BatchOperationPage.path = "/batch_operations/:id";
