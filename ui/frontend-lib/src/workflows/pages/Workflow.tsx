import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { WorkflowContent } from "../components/WorkflowContent";

export const WorkflowPage = () => {
  const { workflow_id } = useParams();

  return (
    <EntityProvider entity_name="workflow" entity_id={workflow_id || ""}>
      <EntityContainer title="Workflow" showActivity={false}>
        <WorkflowContent />
      </EntityContainer>
    </EntityProvider>
  );
};

WorkflowPage.path = "/workflows/:workflow_id";
