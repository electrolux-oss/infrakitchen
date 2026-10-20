import { useNavigate } from "react-router";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { HeroPlusCircleIcon } from "../../icons";
import { Button } from "../../ui";
import {
  userColumns,
  userDefaultColumnVisibilityModel,
} from "../components/userTableConfig";
import { USER_FIELD_MAP } from "../graphql/fragments";

export const UsersPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  return (
    <PageContainer
      title="Users"
      description="People and service accounts with access to InfraKitchen."
      actions={
        <PermissionWrapper
          requiredPermission="api:user"
          permissionAction="write"
        >
          <Button
            onClick={() => navigate(`${linkPrefix}users/create`)}
            startIcon={<HeroPlusCircleIcon />}
          >
            Create Service Account User
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Users"
        entityName="user"
        columns={userColumns}
        entityFieldMap={USER_FIELD_MAP}
        defaultColumnVisibilityModel={userDefaultColumnVisibilityModel}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

UsersPage.path = "/users";
