import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate, useLocation } from "react-router";

import { Button } from "@mui/material";

import { useConfig, FilterConfig, PermissionWrapper } from "../../common";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import {
  buildResourceApiFilters,
  createResourceFilterConfigs,
  resourceColumns,
  resourceDefaultColumnVisibilityModel,
  resourceFields,
} from "../components/resourceTableConfig";

export const ResourcesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();

  const [labels, setLabels] = useState<string[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>(
    [],
  );

  useEffect(() => {
    // Load labels
    ikApi.get("labels/resource").then((response: string[]) => {
      setLabels(response);
    });

    // Load templates
    ikApi
      .getList("templates", {
        pagination: { page: 1, perPage: 1000 },
        fields: ["id", "name"],
        sort: { field: "name", order: "ASC" },
      })
      .then((response: any) => {
        setTemplates(response.data);
      })
      .catch((_) => {
        setTemplates([]);
      });
  }, [ikApi]);

  const cascadingOptions = useMemo(() => {
    return templates.map((template) => {
      return {
        label: template.name,
        value: `template:${template.id}`,
        loadChildren: async (parentValue: string) => {
          const templateId = parentValue.replace("template:", "");
          try {
            const response = await ikApi.getList("source_code_versions", {
              filter: { template_id: templateId },
              pagination: { page: 1, perPage: 1000 },
              fields: ["id", "source_code_version", "source_code_branch"],
            });
            return response.data
              .map((version: any) => ({
                label:
                  version.source_code_version ?? version.source_code_branch,
                value: `scv:${version.id}:${templateId}`,
              }))
              .sort((a: any, b: any) => a.label.localeCompare(b.label));
          } catch {
            notifyError("Failed to load options");
            return [];
          }
        },
      };
    });
  }, [templates, ikApi]);

  const initialFilter = location.state?.filters;

  // Configure filters using the new FilterConfig system
  const filterConfigs: FilterConfig[] = useMemo(() => {
    return createResourceFilterConfigs({
      labels,
      cascadingOptions,
      showTemplateVersionFilter: true,
    });
  }, [labels, cascadingOptions]);

  const buildApiFilters = useCallback((filterValues: Record<string, any>) => {
    return buildResourceApiFilters(filterValues);
  }, []);

  return (
    <PageContainer
      title="Resources"
      actions={
        <PermissionWrapper
          requiredPermission="api:resource"
          permissionAction="read"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}resources/create`)}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Resources"
        entityName="resource"
        columns={resourceColumns}
        defaultColumnVisibilityModel={resourceDefaultColumnVisibilityModel}
        filterConfigs={filterConfigs}
        initialFilters={initialFilter}
        buildApiFilters={buildApiFilters}
        fields={resourceFields}
      />
    </PageContainer>
  );
};

ResourcesPage.path = "/resources";
