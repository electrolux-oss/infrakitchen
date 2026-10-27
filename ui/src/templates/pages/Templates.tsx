import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import {
  FilterProvider,
  PermissionWrapper,
  useLocalStorage,
} from "../../common";
import { EntityCard } from "../../common/components/cards/EntityCard";
import { entityIcons } from "../../common/components/entities/entityIcons";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import {
  EntityListView,
  ViewToggle,
} from "../../common/components/entity_table/ViewToggle";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { StatusLabel } from "../../common/components/labels";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { ENTITY_CARD_GRID_CLASSES } from "../../common/utils/entityCardGrid";
import { HeroArrowDownCircleIcon, HeroPlusCircleIcon } from "../../icons";
import { Alert, Spinner, Button, Link } from "../../ui";
import { cn } from "../../utils/cn";
import { ENTITY_STATUS } from "../../utils/constants";
import { templateColumns } from "../components/templateFilterConfig";
import { buildTemplateTableColumns } from "../components/templateTableConfig";
import {
  GqlTemplate,
  TEMPLATE_FIELD_MAP,
  TEMPLATE_LIST_FIELDS,
} from "../graphql";

const VIEW_STORAGE_KEY = "templates_view";

export const TemplatesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const [templates, setTemplates] = useState<GqlTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const navigate = useNavigate();
  const { get, setKey } = useLocalStorage<Record<string, any>>();
  const [view, setView] = useState<EntityListView>(
    get(VIEW_STORAGE_KEY)?.view === "table" ? "table" : "grid",
  );

  const tableColumns = useMemo(
    () =>
      buildTemplateTableColumns((templateId) =>
        navigate(`${linkPrefix}resources/create`, {
          state: { template_id: templateId },
        }),
      ),
    [navigate, linkPrefix],
  );

  const changeView = (next: EntityListView) => {
    setView(next);
    setKey(VIEW_STORAGE_KEY, { view: next });
  };

  const entityName = "template";

  const fetchTemplates = useCallback(async () => {
    if (view !== "grid") return;
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
  }, [ikApi, filterValues, isInitialLoad, view]);

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
          startIcon={<HeroPlusCircleIcon />}
        >
          Create
        </Button>
        <Button
          className="ml-2"
          onClick={() => navigate(`${linkPrefix}templates/import`)}
          startIcon={<HeroArrowDownCircleIcon />}
        >
          Import
        </Button>
      </PermissionWrapper>
    </div>
  );

  const viewToggle = (
    <ViewToggle value={view} onChange={changeView} ariaLabel="Templates view" />
  );

  const templateCardFields = (template: GqlTemplate) => {
    return (
      <>
        <div>
          <p className="m-0 block text-body2 text-fg-muted">Status</p>
          <StatusLabel status={template.status} compact />
        </div>
        <div>
          <p className="m-0 block text-body2 text-fg-muted">Last Updated</p>{" "}
          <RelativeTime date={template.updatedAt} />
        </div>
      </>
    );
  };

  if (error && view === "grid") {
    return (
      <PageContainer
        title="Templates"
        icon={entityIcons.template}
        actions={actions}
      >
        {viewToggle}
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
      icon={entityIcons.template}
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
      {viewToggle}
      {view === "table" ? (
        <EntityFetchTable
          title="Templates"
          entityName="template"
          columns={tableColumns}
          entityFieldMap={TEMPLATE_FIELD_MAP}
          buildApiFilters={buildAdvancedApiFilters}
          defaultSort={{ field: "name", sort: "asc" }}
          syncFiltersToUrl
        />
      ) : (
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
                    {...(enabled
                      ? { createButtonName: "Create Resource" }
                      : {})}
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
      )}
    </PageContainer>
  );
};

TemplatesPage.path = "/templates";
