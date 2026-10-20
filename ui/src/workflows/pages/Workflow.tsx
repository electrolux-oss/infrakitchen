import { useParams } from "react-router";

import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { HeroArrowsRightLeftIcon } from "../../icons";
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
      <WorkflowPageContent />
    </EntityProvider>
  );
};

const WorkflowPageContent = () => {
  const { entity } = useEntityProvider();

  return (
    // Workflows have no name, so they are headed by their short id, as the
    // overview card was.
    <EntityContainer
      titleIcon={<HeroArrowsRightLeftIcon />}
      title={entity ? `Workflow ${entity.id.slice(0, 8)}…` : "Workflow"}
      actions={<EntityRefreshButton />}
      showEditAction
    >
      <WorkflowContent />
    </EntityContainer>
  );
};

WorkflowPage.path = "/workflows/:workflow_id/:tab?";
