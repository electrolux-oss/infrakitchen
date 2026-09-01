import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Button } from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { workspaceColumns } from "../components/workspaceTableConfig";
import { WORKSPACE_FIELD_MAP } from "../graphql/fragments";

export const WorkspacesPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  return (
    <PageContainer
      title="Workspaces"
      actions={
        <PermissionWrapper
          requiredPermission="api:workspace"
          permissionAction="write"
        >
          <Button
            variant="outlined"
            onClick={() => navigate(`${linkPrefix}workspaces/create`)}
            startIcon={<AddIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Workspaces"
        entityName="workspace"
        columns={workspaceColumns}
        entityFieldMap={WORKSPACE_FIELD_MAP}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

WorkspacesPage.path = "/workspaces";
