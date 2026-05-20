import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { useConfig } from "../../common/context/ConfigContext";

import {
  buildResourceApiFilters,
  resourceColumns,
  resourceDefaultColumnVisibilityModel,
  resourceFields,
} from "./resourceTableConfig";

interface EntityResourcesProps {
  fixedFilters: Record<string, any>;
  filterStorageKey: string;
}

export const EntityResources = ({
  fixedFilters,
  filterStorageKey,
}: EntityResourcesProps) => {
  const { ikApi } = useConfig();
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    ikApi.get("labels/resource").then((response: string[]) => {
      setLabels(response);
    });
  }, [ikApi]);

  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      { id: "name", type: "search", label: "Search", width: 420 },
      {
        id: "labels",
        type: "autocomplete",
        label: "Labels",
        options: labels,
        multiple: true,
        width: 420,
      },
    ],
    [labels],
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
      columns={resourceColumns}
      defaultColumnVisibilityModel={resourceDefaultColumnVisibilityModel}
      filterStorageKey={filterStorageKey}
      filterConfigs={filterConfigs}
      buildApiFilters={buildApiFilters}
      fields={resourceFields}
    />
  );
};
