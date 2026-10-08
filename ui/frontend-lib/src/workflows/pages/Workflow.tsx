import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { TASK_QUEUE_STATUS_SELECTION } from "../../workers/graphql";
import { WorkflowContent } from "../components/WorkflowContent";
import { WORKFLOW_FIELDS } from "../graphql";

// Queue state is fetched with the entity in the same request
const PAGE_FIELDS = `${WORKFLOW_FIELDS}${TASK_QUEUE_STATUS_SELECTION}`;

export const WorkflowPage = () => {
  const { workflow_id } = useParams();

  return (
    <EntityProvider
      entity_name="workflow"
      entity_id={workflow_id || ""}
      entityFields={PAGE_FIELDS}
      // workflow events carry every step and are cut down for the live stream
      refetchOnEvent
    >
      <EntityContainer title="Workflow" showEditAction>
        <WorkflowContent />
      </EntityContainer>
    </EntityProvider>
  );
};

WorkflowPage.path = "/workflows/:workflow_id/:tab?";
