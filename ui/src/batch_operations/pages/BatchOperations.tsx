import { useNavigate } from "react-router";

import { PermissionWrapper, useConfig } from "../../common";
import { entityIcons } from "../../common/components/entities/entityIcons";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { HeroPlusCircleIcon } from "../../icons";
import { Button } from "../../ui";
import { batchOperationColumns } from "../components/batchOperationTableConfig";
import { BATCH_OPERATION_FIELD_MAP } from "../graphql";

export const BatchOperationsPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  return (
    <PageContainer
      title="Batch Operations"
      icon={entityIcons.batch_operation}
      description="Run one action — such as previewing or applying changes — across multiple resources or executors at once."
      actions={
        <PermissionWrapper
          requiredPermission="api:batch_operation"
          permissionAction="read"
        >
          <Button
            onClick={() => navigate(`${linkPrefix}batch_operations/create`)}
            startIcon={<HeroPlusCircleIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Batch Operations"
        entityName="batchOperation"
        columns={batchOperationColumns}
        entityFieldMap={BATCH_OPERATION_FIELD_MAP}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

BatchOperationsPage.path = "/batch_operations";
