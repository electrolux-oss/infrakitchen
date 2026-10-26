import { useNavigate } from "react-router";

import { PermissionWrapper, useConfig } from "../../common";
import { entityIcons } from "../../common/components/entities/entityIcons";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { HeroPlusCircleIcon } from "../../icons";
import { Button } from "../../ui";
import { workspaceColumns } from "../components/workspaceTableConfig";
import { WORKSPACE_FIELD_MAP } from "../graphql/fragments";

export const WorkspacesPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  return (
    <PageContainer
      title="Workspaces"
      icon={entityIcons.workspace}
      description="Git repositories where generated infrastructure code is synced and reviewed through pull requests."
      actions={
        <PermissionWrapper
          requiredPermission="api:workspace"
          permissionAction="write"
        >
          <Button
            onClick={() => navigate(`${linkPrefix}workspaces/create`)}
            startIcon={<HeroPlusCircleIcon />}
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
