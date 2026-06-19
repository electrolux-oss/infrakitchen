import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate, useLocation } from "react-router";

import AddIcon from "@mui/icons-material/Add";
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
} from "../components/resourceTableConfig";
import { RESOURCE_FIELD_MAP } from "../graphql/fragments";

export const ResourcesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();

  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    ikApi
      .graphqlRequest<{ labels: string[] }>(
        `query ResourceLabels {
        labels: labels(entity: "resource")
      }`,
      )
      .then((response) => {
        setLabels(response.labels || []);
      });
  }, [ikApi]);

  const makeTemplateOption = useCallback(
    (template: { id: string; name: string }) => ({
      label: template.name,
      value: `template:${template.id}`,
      loadChildren: async (parentValue: string) => {
        const templateId = parentValue.replace("template:", "");
        try {
          const scvResponse = await ikApi.graphqlRequest<{
            sourceCodeVersions: Array<{
              id: string;
              sourceCodeVersion: string | null;
              sourceCodeBranch: string | null;
            }>;
          }>(
            `query ResourceTemplateVersions($filter: JSON, $sort: [String!], $range: [Int!]) {
              sourceCodeVersions(filter: $filter, sort: $sort, range: $range) {
                id
                sourceCodeVersion
                sourceCodeBranch
              }
            }`,
            {
              filter: { template_id: templateId },
              sort: ["sourceCodeVersion", "ASC"],
              range: [0, 1000],
            },
          );
          return (scvResponse.sourceCodeVersions || [])
            .map((version: any) => ({
              label: version.sourceCodeVersion ?? version.sourceCodeBranch,
              value: `scv:${version.id}:${templateId}`,
            }))
            .sort((a: any, b: any) => a.label.localeCompare(b.label));
        } catch {
          notifyError("Failed to load versions");
          return [];
        }
      },
    }),
    [ikApi],
  );

  const loadTemplateOptions = useCallback(
    async (search: string, page: number) => {
      const perPage = 10;
      const skip = (page - 1) * perPage;
      const end = skip + perPage;
      const response = await ikApi.graphqlRequest<{
        templates: Array<{ id: string; name: string }>;
      }>(
        `query ResourceTemplates($filter: JSON, $sort: [String!], $range: [Int!]) {
          templates(filter: $filter, sort: $sort, range: $range) {
            id
            name
          }
        }`,
        {
          filter: search ? { name__like: search } : null,
          sort: ["name", "ASC"],
          range: [skip, end],
        },
      );

      const templates = response.templates || [];
      return {
        options: templates.map(makeTemplateOption),
        hasMore: templates.length === perPage,
      };
    },
    [ikApi, makeTemplateOption],
  );

  const loadTemplateOptionByValue = useCallback(
    async (value: string) => {
      const id = value.replace("template:", "");
      try {
        const response = await ikApi.graphqlRequest<{
          template: { id: string; name: string } | null;
        }>(
          `query ResourceTemplate($id: UUID!) {
            template(id: $id) {
              id
              name
              template
            }
          }`,
          { id },
        );
        const template = response.template;
        return template ? makeTemplateOption(template) : null;
      } catch {
        return null;
      }
    },
    [ikApi, makeTemplateOption],
  );

  const initialFilter = location.state?.filters;

  // Configure filters using the new FilterConfig system
  const filterConfigs: FilterConfig[] = useMemo(() => {
    return createResourceFilterConfigs({
      labels,
      loadTemplateOptions,
      loadTemplateOptionByValue,
      showTemplateVersionFilter: true,
    });
  }, [labels, loadTemplateOptions, loadTemplateOptionByValue]);

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
            startIcon={<AddIcon />}
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
        entityFieldMap={RESOURCE_FIELD_MAP}
        defaultColumnVisibilityModel={resourceDefaultColumnVisibilityModel}
        filterConfigs={filterConfigs}
        initialFilters={initialFilter}
        buildApiFilters={buildApiFilters}
      />
    </PageContainer>
  );
};

ResourcesPage.path = "/resources";
