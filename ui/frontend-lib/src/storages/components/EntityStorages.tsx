import { useCallback } from "react";

import { useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { STORAGE_FIELD_MAP } from "../graphql/fragments";

import {
  storageColumns,
  storageDefaultColumnVisibilityModel,
} from "./storageTableConfig";

interface EntityStoragesProps {
  fixedFilters: Record<string, any>;
  filterStorageKey: string;
}

export const EntityStorages = ({
  fixedFilters,
  filterStorageKey,
}: EntityStoragesProps) => {
  useConfig();

  const buildApiFilters = useCallback(
    (filterValues: Record<string, any>) => ({
      ...buildAdvancedApiFilters(filterValues),
      ...fixedFilters,
    }),
    [fixedFilters],
  );

  return (
    <EntityFetchTable
      title="Storages"
      entityName="storage"
      entityFieldMap={STORAGE_FIELD_MAP}
      columns={storageColumns}
      defaultColumnVisibilityModel={storageDefaultColumnVisibilityModel}
      filterStorageKey={filterStorageKey}
      buildApiFilters={buildApiFilters}
    />
  );
};
