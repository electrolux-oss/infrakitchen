import { useCallback } from "react";

import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { workspaceColumns } from "../../workspaces/components/workspaceTableConfig";
import { WORKSPACE_FIELD_MAP } from "../../workspaces/graphql/fragments";

interface IntegrationWorkspaceDependenciesProps {
  integration_id: string;
}

export const IntegrationWorkspaceDependencies = (
  props: IntegrationWorkspaceDependenciesProps,
) => {
  const { integration_id } = props;

  const defaultColumnVisibilityModel = {
    description: false,
  };

  const buildApiFilters = useCallback(
    (filterValues: Record<string, any>) => ({
      ...buildAdvancedApiFilters(filterValues),
      integration_id,
    }),
    [integration_id],
  );

  return (
    <EntityFetchTable
      title="Workspaces"
      entityName="workspace"
      columns={workspaceColumns}
      entityFieldMap={WORKSPACE_FIELD_MAP}
      defaultColumnVisibilityModel={defaultColumnVisibilityModel}
      filterStorageKey={`filter_integration_workspaces`}
      buildApiFilters={buildApiFilters}
    />
  );
};
