import { useCallback, useMemo } from "react";

import { FilterConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RESOURCE_FIELD_MAP } from "../graphql";

import {
  buildResourceApiFilters,
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
  const filterConfigs: FilterConfig[] = useMemo(
    () => [{ id: "name", type: "search", label: "Search", width: 420 }],
    [],
  );

  const buildApiFilters = useCallback(
    (filterValues: Record<string, any>) => ({
      ...buildResourceApiFilters(filterValues),
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
      filterConfigs={filterConfigs}
      buildApiFilters={buildApiFilters}
    />
  );
};
