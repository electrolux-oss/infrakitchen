import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Button } from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
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
      actions={
        <PermissionWrapper
          requiredPermission="api:user"
          permissionAction="write"
        >
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(`${linkPrefix}users/create`)}
            startIcon={<AddIcon />}
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
