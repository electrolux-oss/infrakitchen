import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Button } from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { batchOperationColumns } from "../components/batchOperationTableConfig";
import { BATCH_OPERATION_FIELD_MAP } from "../graphql";

export const BatchOperationsPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  return (
    <PageContainer
      title="Batch Operations"
      actions={
        <PermissionWrapper
          requiredPermission="api:batch_operation"
          permissionAction="read"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}batch_operations/create`)}
            startIcon={<AddIcon />}
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
