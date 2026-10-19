import { useNavigate } from "react-router";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { HeroPlusCircleIcon } from "../../icons";
import { Button } from "../../ui";
import { roleColumns } from "../components/roleTableConfig";

export const RolesPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  return (
    <PageContainer
      title="Roles"
      description="Access roles that control what users and service accounts can do."
      actions={
        <PermissionWrapper
          requiredPermission="api:permission"
          permissionAction="write"
        >
          <Button
            onClick={() => navigate(`${linkPrefix}roles/create`)}
            startIcon={<HeroPlusCircleIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Roles"
        entityName="role"
        columns={roleColumns}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

RolesPage.path = "/roles";
