import { useCallback } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Button } from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import PageContainer from "../../common/PageContainer";
import {
  storageColumns,
  storageDefaultColumnVisibilityModel,
} from "../components/storageTableConfig";
import { STORAGE_FIELD_MAP } from "../graphql/fragments";

export const StoragesPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  const buildApiFilters = useCallback((filterValues: Record<string, any>) => {
    return buildAdvancedApiFilters(filterValues);
  }, []);

  return (
    <PageContainer
      title="Storages"
      actions={
        <PermissionWrapper
          requiredPermission="api:storage"
          permissionAction="write"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}storages/create`)}
            startIcon={<AddIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Storages"
        entityName="storage"
        columns={storageColumns}
        entityFieldMap={STORAGE_FIELD_MAP}
        buildApiFilters={buildApiFilters}
        defaultColumnVisibilityModel={storageDefaultColumnVisibilityModel}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

StoragesPage.path = "/storages";
