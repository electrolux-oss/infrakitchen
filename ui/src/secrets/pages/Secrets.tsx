import { useNavigate } from "react-router";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { HeroPlusCircleIcon } from "../../icons";
import { Button } from "../../ui";
import {
  secretColumns,
  secretDefaultColumnVisibilityModel,
} from "../components/secretTableConfig";
import { SECRET_FIELD_MAP } from "../graphql/fragments";

export const SecretsPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  return (
    <PageContainer
      title="Secrets"
      description="Securely manage credentials, API keys, and other sensitive values for your infrastructure."
      actions={
        <PermissionWrapper
          requiredPermission="api:secret"
          permissionAction="write"
        >
          <Button
            onClick={() => navigate(`${linkPrefix}secrets/create`)}
            startIcon={<HeroPlusCircleIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Secrets"
        entityName="secret"
        columns={secretColumns}
        defaultColumnVisibilityModel={secretDefaultColumnVisibilityModel}
        entityFieldMap={SECRET_FIELD_MAP}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

SecretsPage.path = "/secrets";
