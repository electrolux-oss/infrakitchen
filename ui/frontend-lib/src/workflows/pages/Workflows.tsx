import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { workflowColumns } from "../components/workflowTableConfig";
import { WORKFLOW_FIELD_MAP } from "../graphql";

export const WorkflowsPage = () => {
  return (
    <PageContainer
      title="Workflows"
      description="Orchestrated runs that execute multiple resources in dependency order."
    >
      <EntityFetchTable
        title="Workflows"
        entityName="workflow"
        columns={workflowColumns}
        entityFieldMap={WORKFLOW_FIELD_MAP}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

WorkflowsPage.path = "/workflows";
