import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { useConfig } from "../../common/context/ConfigContext";
import {
  buildResourceApiFilters,
  resourceColumns,
  resourceDefaultColumnVisibilityModel,
  resourceFields,
} from "../../resources/components/resourceTableConfig";

interface StorageResourcesProps {
  storage_id: string;
}

export const StorageResources = (props: StorageResourcesProps) => {
  const { storage_id } = props;
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
      storage_id: storage_id,
    }),
    [storage_id],
  );

  return (
    <EntityFetchTable
      title="Resources"
      entityName="resource"
      columns={resourceColumns}
      defaultColumnVisibilityModel={resourceDefaultColumnVisibilityModel}
      filterStorageKey={`filter_storage_resources_${storage_id}`}
      filterConfigs={filterConfigs}
      buildApiFilters={buildApiFilters}
      fields={resourceFields}
    />
  );
};
