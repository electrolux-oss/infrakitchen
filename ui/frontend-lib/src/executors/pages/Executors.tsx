import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Button } from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { executorColumns } from "../components/executorTableConfig";
import { EXECUTOR_FIELD_MAP } from "../graphql/fragments";

export const ExecutorsPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  return (
    <PageContainer
      title="Executors"
      description="Run infrastructure code from a repository whenever you need to, without a reusable template."
      actions={
        <PermissionWrapper
          requiredPermission="api:executor"
          permissionAction="read"
        >
          <Button
            onClick={() => navigate(`${linkPrefix}executors/create`)}
            startIcon={<AddIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Executors"
        entityName="executor"
        columns={executorColumns}
        entityFieldMap={EXECUTOR_FIELD_MAP}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

ExecutorsPage.path = "/executors";
