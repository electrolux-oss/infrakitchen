import { useCallback, useEffect, useMemo, useState } from "react";

import { Box } from "@mui/material";

import { FilterConfig, useConfig, useLocalStorage } from "../../common";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import {
  buildResourceApiFilters,
  createResourceFilterConfigs,
  resourceColumns,
  resourceFields,
} from "../../resources/components/resourceTableConfig";

interface TemplateResourcesProps {
  template_id: string;
}
export const TemplateResources = (props: TemplateResourcesProps) => {
  const { template_id } = props;
  const { ikApi } = useConfig();

  const { value } = useLocalStorage<{
    expanded?: Record<string, boolean>;
  }>();

  const expandedMap = value.expanded ?? {};
  const isExpanded = expandedMap["template-resources"];

  const [labels, setLabels] = useState<string[]>([]);
  const [versionOptions, setVersionOptions] = useState<
    { label: string; value: string }[]
  >([]);

  useEffect(() => {
    if (!template_id || !isExpanded) return;
    ikApi
      .get("labels/resource")
      .then((response: string[]) => {
        setLabels(response);
      })
      .catch(() => {
        setLabels([]);
      });
  }, [ikApi, template_id, isExpanded]);

  useEffect(() => {
    if (!template_id) return;
    if (!isExpanded) return;

    ikApi
      .getList("source_code_versions", {
        filter: { template_id },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "updated_at", order: "DESC" },
        fields: ["id", "source_code_version", "source_code_branch"],
      })
      .then((response) => {
        const options = (response.data || [])
          .map((version: any) => ({
            label:
              version.source_code_version ??
              version.source_code_branch ??
              version.id,
            value: String(version.id),
          }))
          .sort((a: { label: string }, b: { label: string }) =>
            a.label.localeCompare(b.label),
          );

        setVersionOptions(options);
      })
      .catch(() => {
        setVersionOptions([]);
      });
  }, [ikApi, template_id, isExpanded]);

  const filterConfigs: FilterConfig[] = useMemo(() => {
    return createResourceFilterConfigs({
      labels,
      versionOptions,
      showTemplateVersionFilter: false,
    });
  }, [labels, versionOptions]);

  const templateResourceColumnVisibilityModel = useMemo(
    () => ({
      name: true,
      source_code_version: true,
      state: true,
      created_at: true,
      updated_at: true,
      Favorite: false,
      template: false,
      creator: false,
      storage: false,
      workspace: false,
      integration_ids: false,
      secret_ids: false,
      parents: false,
      children: false,
      variables: false,
      outputs: false,
      labels: false,
      dependency_tags: false,
      dependency_config: false,
    }),
    [],
  );

  const buildApiFilters = useCallback(
    (filterValues: Record<string, any>) => {
      return buildResourceApiFilters(filterValues, template_id);
    },
    [template_id],
  );

  if (!template_id) return null;

  return (
    <PropertyCollapseCard
      id="template-resources"
      title="Resources"
      subtitle="Resources provisioned (or to be provisioned) from this template"
    >
      {isExpanded && (
        <Box sx={{ width: "100%" }}>
          <EntityFetchTable
            title="Template Resources"
            entityName="resource"
            columns={resourceColumns}
            defaultColumnVisibilityModel={templateResourceColumnVisibilityModel}
            fields={resourceFields}
            filterConfigs={filterConfigs}
            buildApiFilters={buildApiFilters}
          />
        </Box>
      )}
    </PropertyCollapseCard>
  );
};
