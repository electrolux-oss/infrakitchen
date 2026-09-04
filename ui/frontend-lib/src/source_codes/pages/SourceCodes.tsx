import { useNavigate } from "react-router";

import InputIcon from "@mui/icons-material/Input";
import { Button } from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import {
  sourceCodeColumns,
  sourceCodeDefaultColumnVisibilityModel,
} from "../components/sourceCodeTableConfig";
import { SOURCE_CODE_FIELD_MAP } from "../graphql";

export const SourceCodesPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const actions = (
    <PermissionWrapper
      requiredPermission="api:source_code"
      permissionAction="write"
    >
      <Button
        onClick={() => navigate(`${linkPrefix}source_codes/create`)}
        startIcon={<InputIcon />}
      >
        Import
      </Button>
    </PermissionWrapper>
  );

  return (
    <PageContainer
      title="Code Repositories"
      description="Register Git repositories containing Terraform or OpenTofu modules used by your templates and executors."
      actions={actions}
    >
      <EntityFetchTable
        title="Code Repositories"
        entityName="sourceCode"
        columns={sourceCodeColumns}
        defaultColumnVisibilityModel={sourceCodeDefaultColumnVisibilityModel}
        entityFieldMap={SOURCE_CODE_FIELD_MAP}
        syncFiltersToUrl
        defaultSort={{ field: "updated_at", sort: "desc" }}
      />
    </PageContainer>
  );
};

SourceCodesPage.path = "/source_codes";
