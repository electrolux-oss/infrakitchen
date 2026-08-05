import { useCallback } from "react";

import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { RESOURCE_FIELD_MAP } from "../graphql";

import {
  buildAdvancedApiFilters,
  resourceColumns,
  resourceDefaultColumnVisibilityModel,
} from "./resourceTableConfig";

interface EntityResourcesProps {
  fixedFilters: Record<string, any>;
  filterStorageKey: string;
}

export const EntityResources = ({
  fixedFilters,
  filterStorageKey,
}: EntityResourcesProps) => {
  const buildApiFilters = useCallback(
    (filterValues: Record<string, any>) => ({
      ...buildAdvancedApiFilters(filterValues),
      ...fixedFilters,
    }),
    [fixedFilters],
  );

  return (
    <EntityFetchTable
      title="Resources"
      entityName="resource"
      entityFieldMap={RESOURCE_FIELD_MAP}
      columns={resourceColumns}
      defaultColumnVisibilityModel={resourceDefaultColumnVisibilityModel}
      filterStorageKey={filterStorageKey}
      buildApiFilters={buildApiFilters}
    />
  );
};
