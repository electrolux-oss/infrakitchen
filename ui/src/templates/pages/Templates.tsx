import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router";

import { FilterProvider, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/cards/EntityCard";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { ENTITY_CARD_GRID_CLASSES } from "../../common/utils/entityCardGrid";
import { AddIcon, InputIcon } from "../../icons/material";
import { Alert, Spinner, Button, Link } from "../../ui";
import { cn } from "../../utils/cn";
import { ENTITY_STATUS } from "../../utils/constants";
import { templateColumns } from "../components/templateFilterConfig";
import { GqlTemplate, TEMPLATE_LIST_FIELDS } from "../graphql";

export const TemplatesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const [templates, setTemplates] = useState<GqlTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const navigate = useNavigate();

  const entityName = "template";

  const fetchTemplates = useCallback(async () => {
    const apiFilters = buildAdvancedApiFilters(filterValues);

    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await ikApi.graphqlRequest<{
        templates: GqlTemplate[];
      }>(
        `  query Templates($filter: JSON, $sort: [String!], $range: [Int!]) {
                          templates(filter: $filter, sort: $sort, range: $range) {
                            ${TEMPLATE_LIST_FIELDS}
                          }
                        }
              `,
        {
          filter: Object.keys(apiFilters).length > 0 ? apiFilters : null,
          sort: ["name", "ASC"],
          range: [0, 1000],
        },
      );
      setTemplates(response.templates || []);
      setIsInitialLoad(false);
    } catch (error: any) {
      setError(error.message || "Failed to fetch templates");
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [ikApi, filterValues, isInitialLoad]);

  const handleFilterChange = useCallback(
    (newFilterValues: Record<string, any>) => {
      setFilterValues(newFilterValues);
    },
    [],
  );

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const actions = (
    <div>
      <PermissionWrapper
        requiredPermission="api:template"
        permissionAction="write"
      >
        <Button
          onClick={() => navigate(`${linkPrefix}templates/create`)}
          startIcon={<AddIcon />}
        >
          Create
        </Button>
        <Button
          className="ml-2"
          onClick={() => navigate(`${linkPrefix}templates/import`)}
          startIcon={<InputIcon />}
        >
          Import
        </Button>
      </PermissionWrapper>
    </div>
  );

  const templateCardFields = (template: GqlTemplate) => {
    return (
      <>
        <div>
          <p className="m-0 block text-body2 text-fg-muted">Status</p>
          <StatusChip status={template.status} compact />
        </div>
        <div>
          <p className="m-0 block text-body2 text-fg-muted">Last Updated</p>{" "}
          <RelativeTime date={template.updatedAt} />
        </div>
      </>
    );
  };

  if (error) {
    return (
      <PageContainer title="Templates" actions={actions}>
        <div className="w-full py-8">
          <Alert className="mb-4" severity="error">
            {error}
          </Alert>
          <Button onClick={fetchTemplates}>Retry</Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Templates"
      description={
        <>
          <Link
            href="https://opensource.electrolux.one/infrakitchen/concepts/template"
            target="_blank"
            rel="noopener"
            color="inherit"
            className="decoration-current"
          >
            Templates
          </Link>{" "}
          are versioned, reusable building blocks that enable consistent
          self-service infrastructure provisioning and management.
        </>
      }
      actions={actions}
    >
      <div className="w-full">
        <FilterProvider
          columns={templateColumns}
          storageKey={`filter_${entityName}s`}
          onFilterChange={handleFilterChange}
          syncToUrl
        >
          <FilterPanel />
        </FilterProvider>
        {loading ? (
          <div className="flex h-[50vh] items-center justify-center">
            <Spinner />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-8 text-center">
            <p className="m-0 text-h5">No templates available</p>
          </div>
        ) : (
          <div className={cn(ENTITY_CARD_GRID_CLASSES, "mt-6")}>
            {templates.map((template) => {
              // The API serializes status with its display casing (e.g.
              // "DISABLED"); normalize before comparing against the lowercase
              // constant so disabled templates don't keep their CTA.
              const enabled =
                String(template.status ?? "").toLocaleLowerCase() !==
                ENTITY_STATUS.DISABLED;

              return (
                <EntityCard
                  key={template.id}
                  entity_name="template"
                  name={template.name}
                  description={template.description ?? ""}
                  status={template.status}
                  detailsUrl={`${linkPrefix}templates/${template.id}`}
                  {...(enabled && {
                    onCreateClick: () =>
                      navigate(`${linkPrefix}resources/create`, {
                        state: { template_id: template.id },
                      }),
                  })}
                  {...(enabled ? { createButtonName: "Create Resource" } : {})}
                  labels={template.labels || []}
                  labelsMax={5}
                  chip={template.abstract ? "Abstract" : undefined}
                  lastUpdated={template.updatedAt}
                  entityFields={templateCardFields(template)}
                />
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

TemplatesPage.path = "/templates";
