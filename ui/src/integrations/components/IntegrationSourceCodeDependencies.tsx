import { useCallback } from "react";

import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { sourceCodeColumns } from "../../source_codes/components/sourceCodeTableConfig";
import { SOURCE_CODE_FIELD_MAP } from "../../source_codes/graphql";

interface IntegrationSourceCodeDependenciesProps {
  integration_id: string;
}

export const IntegrationSourceCodeDependencies = (
  props: IntegrationSourceCodeDependenciesProps,
) => {
  const { integration_id } = props;

  const defaultColumnVisibilityModel = {
    description: false,
    sourceCodeProvider: false,
    sourceCodeLanguage: false,
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
      title="Code Repositories"
      entityName="sourceCode"
      columns={sourceCodeColumns}
      entityFieldMap={SOURCE_CODE_FIELD_MAP}
      defaultColumnVisibilityModel={defaultColumnVisibilityModel}
      filterStorageKey={`filter_integration_code_repos`}
      buildApiFilters={buildApiFilters}
    />
  );
};
