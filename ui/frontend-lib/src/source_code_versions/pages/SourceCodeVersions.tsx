import { useNavigate } from "react-router";

import { Button } from "@mui/material";

import { useConfig, PermissionWrapper } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { sourceCodeVersionColumns } from "../components/sourceCodeVersionTableConfig";
import { SCV_FIELD_MAP } from "../graphql/fragments";

export const SourceCodeVersionsPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  return (
    <PageContainer
      title="Template Versions"
      actions={
        <PermissionWrapper
          requiredPermission="api:source_code_version"
          permissionAction="write"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}source_code_versions/create`)}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Code Versions"
        entityName="sourceCodeVersion"
        columns={sourceCodeVersionColumns}
        entityFieldMap={SCV_FIELD_MAP}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

SourceCodeVersionsPage.path = "/source_code_versions";
