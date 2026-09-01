import { useCallback } from "react";

import { useNavigate, useLocation } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Button } from "@mui/material";

import { useConfig, PermissionWrapper } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import {
  buildAdvancedApiFilters,
  resourceColumns,
  resourceDefaultColumnVisibilityModel,
} from "../components/resourceTableConfig";
import { RESOURCE_FIELD_MAP } from "../graphql/fragments";

export const ResourcesPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();

  const initialFilter = location.state?.filters;

  const buildApiFilters = useCallback((filterValues: Record<string, any>) => {
    return buildAdvancedApiFilters(filterValues);
  }, []);

  return (
    <PageContainer
      title="Resources"
      actions={
        <PermissionWrapper
          requiredPermission="api:resource"
          permissionAction="read"
        >
          {" "}
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(`${linkPrefix}resources/create`)}
            startIcon={<AddIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Resources"
        entityName="resource"
        columns={resourceColumns}
        entityFieldMap={RESOURCE_FIELD_MAP}
        defaultColumnVisibilityModel={resourceDefaultColumnVisibilityModel}
        initialFilters={initialFilter}
        buildApiFilters={buildApiFilters}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

ResourcesPage.path = "/resources";
