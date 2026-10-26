import { useCallback } from "react";

import { useNavigate, useLocation } from "react-router";

import { useConfig, PermissionWrapper } from "../../common";
import { entityIcons } from "../../common/components/entities/entityIcons";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { HeroPlusCircleIcon } from "../../icons";
import { Button } from "../../ui";
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
      icon={entityIcons.resource}
      description="Infrastructure provisioned from your templates and managed end to end."
      actions={
        <PermissionWrapper
          requiredPermission="api:resource"
          permissionAction="read"
        >
          {" "}
          <Button
            onClick={() => navigate(`${linkPrefix}resources/create`)}
            startIcon={<HeroPlusCircleIcon />}
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
