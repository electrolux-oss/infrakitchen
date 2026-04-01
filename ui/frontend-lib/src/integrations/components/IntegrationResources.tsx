import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { useConfig } from "../../common/context/ConfigContext";
import {
  buildResourceApiFilters,
  createResourceFilterConfigs,
  resourceColumns,
  resourceDefaultColumnVisibilityModel,
  resourceFields,
} from "../../resources/components/resourceTableConfig";

interface IntegrationResourcesProps {
  integration_id: string;
}

export const IntegrationResources = (props: IntegrationResourcesProps) => {
  const { integration_id } = props;
  const { ikApi } = useConfig();
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    ikApi.get("labels/resource").then((response: string[]) => {
      setLabels(response);
    });
  }, [ikApi]);

  const filterConfigs: FilterConfig[] = useMemo(() => {
    return createResourceFilterConfigs({
      labels,
      showTemplateVersionFilter: false,
    });
  }, [labels]);

  const buildApiFilters = useCallback(
    (filterValues: Record<string, any>) => {
      return {
        ...buildResourceApiFilters(filterValues),
        integration_ids__any: [integration_id],
      };
    },
    [integration_id],
  );

  return (
    <EntityFetchTable
      title="Resources"
      entityName="resource"
      columns={resourceColumns}
      defaultColumnVisibilityModel={resourceDefaultColumnVisibilityModel}
      filterConfigs={filterConfigs}
      buildApiFilters={buildApiFilters}
      fields={resourceFields}
    />
  );
};
