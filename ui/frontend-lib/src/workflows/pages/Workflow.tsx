import { useCallback } from "react";

import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/EntityContainer";
import { useConfig } from "../../common/context/ConfigContext";
import { EntityProvider } from "../../common/context/EntityContext";
import { WorkflowContent } from "../components/WorkflowContent";
import { WORKFLOW_QUERY } from "../graphql/queries";
import { GqlWorkflow, transformWorkflow } from "../graphql/transforms";

export const WorkflowPage = () => {
  const { workflow_id } = useParams();
  const { ikApi } = useConfig();

  const fetchWorkflow = useCallback(
    async (_name: string, id: string) => {
      const { workflow } = await ikApi.graphqlRequest<{
        workflow: GqlWorkflow | null;
      }>(WORKFLOW_QUERY, { id });
      if (!workflow) throw new Error("Workflow not found");
      return transformWorkflow(workflow);
    },
    [ikApi],
  );

  return (
    <EntityProvider
      entity_name="workflow"
      entity_id={workflow_id || ""}
      fetchFn={fetchWorkflow}
    >
      <EntityContainer title="Workflow">
        <WorkflowContent />
      </EntityContainer>
    </EntityProvider>
  );
};

WorkflowPage.path = "/workflows/:workflow_id/:tab?";
