import { useCallback, useEffect, useMemo, useState } from "react";

import { Box } from "@mui/material";

import { FilterConfig, useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
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

  const [labels, setLabels] = useState<string[]>([]);
  const [versionLabels, setVersionLabels] = useState<string[]>([]);
  const [versionIdByLabel, setVersionIdByLabel] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!template_id) return;
    ikApi
      .get("labels/resource")
      .then((response: string[]) => {
        setLabels(response);
      })
      .catch(() => {
        setLabels([]);
      });
  }, [ikApi, template_id]);

  useEffect(() => {
    if (!template_id) return;

    ikApi
      .getList("source_code_versions", {
        filter: { template_id },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "updated_at", order: "DESC" },
        fields: ["id", "source_code_version", "source_code_branch"],
      })
      .then((response) => {
        const sorted = (response.data || [])
          .map((version: any) => ({
            label:
              version.source_code_version ??
              version.source_code_branch ??
              version.id,
            value: String(version.id),
          }))
          .sort(
            (
              a: { label: string; value: string },
              b: { label: string; value: string },
            ) => a.label.localeCompare(b.label),
          );
        setVersionLabels(sorted.map((o: { label: string }) => o.label));
        setVersionIdByLabel(
          Object.fromEntries(
            sorted.map((o: { label: string; value: string }) => [
              o.label,
              o.value,
            ]),
          ),
        );
      })
      .catch(() => {
        setVersionLabels([]);
        setVersionIdByLabel({});
      });
  }, [ikApi, template_id]);

  const filterConfigs: FilterConfig[] = useMemo(() => {
    return createResourceFilterConfigs({
      labels,
      versionOptions: versionLabels,
      showTemplateVersionFilter: false,
    });
  }, [labels, versionLabels]);

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
      const resolved = { ...filterValues };
      if (filterValues.source_code_version_id) {
        const id = versionIdByLabel[filterValues.source_code_version_id];

        if (id) {
          resolved.source_code_version_id = id;
        } else {
          delete resolved.source_code_version_id;
        }
      }
      return buildResourceApiFilters(resolved, template_id);
    },
    [template_id, versionIdByLabel],
  );

  if (!template_id) return null;

  return (
    <Box sx={{ width: "100%" }}>
      <EntityFetchTable
        title="Resources"
        subtitle="Resources provisioned (or to be provisioned) from this template"
        entityName="resource"
        columns={resourceColumns}
        defaultColumnVisibilityModel={templateResourceColumnVisibilityModel}
        filterStorageKey={`filter_template_resources_${template_id}`}
        fields={resourceFields}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
      />
    </Box>
  );
};
