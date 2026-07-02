import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { WorkflowContent } from "../components/WorkflowContent";
import { WORKFLOW_FIELDS } from "../graphql";

export const WorkflowPage = () => {
  const { workflow_id } = useParams();

  return (
    <EntityProvider
      entity_name="workflow"
      entity_id={workflow_id || ""}
      entityFields={WORKFLOW_FIELDS}
    >
      <EntityContainer title="Workflow" showEditAction>
        <WorkflowContent />
      </EntityContainer>
    </EntityProvider>
  );
};

WorkflowPage.path = "/workflows/:workflow_id/:tab?";
