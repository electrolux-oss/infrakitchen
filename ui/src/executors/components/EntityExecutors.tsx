import { useCallback } from "react";

import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { EXECUTOR_FIELD_MAP } from "../graphql/fragments";

import { executorColumns } from "./executorTableConfig";

interface EntityExecutorsProps {
  fixedFilters: Record<string, any>;
  filterStorageKey: string;
}

export const EntityExecutors = ({
  fixedFilters,
  filterStorageKey,
}: EntityExecutorsProps) => {
  const buildApiFilters = useCallback(
    (filterValues: Record<string, any>) => ({
      ...buildAdvancedApiFilters(filterValues),
      ...fixedFilters,
    }),
    [fixedFilters],
  );

  return (
    <EntityFetchTable
      title="Executors"
      entityName="executor"
      entityFieldMap={EXECUTOR_FIELD_MAP}
      columns={executorColumns}
      filterStorageKey={filterStorageKey}
      buildApiFilters={buildApiFilters}
    />
  );
};
