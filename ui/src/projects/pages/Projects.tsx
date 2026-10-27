import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router";

import { FilterProvider, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/cards/EntityCard";
import { entityIcons } from "../../common/components/entities/entityIcons";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { Label } from "../../common/components/labels";
import { StatusLabel } from "../../common/components/labels";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { getScoreChipColor } from "../../golden_state/GoldenStateWidget";
import { HeroPlusCircleIcon } from "../../icons";
import { Alert, Spinner, Button, Link } from "../../ui";
import { projectColumns } from "../components/projectTableConfig";
import { GqlProject, PROJECT_LIST_FIELDS } from "../graphql";

export const ProjectsPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const [projects, setProjects] = useState<GqlProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const navigate = useNavigate();

  const entityName = "project";

  const fetchProjects = useCallback(async () => {
    const apiFilters = buildAdvancedApiFilters(filterValues);

    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await ikApi.graphqlRequest<{
        projects: GqlProject[];
      }>(
        `  query Projects($filter: JSON, $sort: [String!], $range: [Int!]) {
                          projects(filter: $filter, sort: $sort, range: $range) {
                            ${PROJECT_LIST_FIELDS}
                          }
                        }
              `,
        {
          filter: Object.keys(apiFilters).length > 0 ? apiFilters : null,
          sort: ["name", "ASC"],
          range: [0, 1000],
        },
      );
      setProjects(response.projects || []);
      setIsInitialLoad(false);
    } catch (error: any) {
      setError(error.message || "Failed to fetch projects");
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
    fetchProjects();
  }, [fetchProjects]);

  const actions = (
    <div>
      <PermissionWrapper
        requiredPermission="api:project"
        permissionAction="write"
      >
        <Button
          onClick={() => navigate(`${linkPrefix}projects/create`)}
          startIcon={<HeroPlusCircleIcon />}
        >
          Create
        </Button>
      </PermissionWrapper>
    </div>
  );

  const projectCardFields = (project: GqlProject) => {
    return (
      <>
        <div>
          <p className="m-0 block text-body2 text-fg-muted">Status</p>
          <StatusLabel status={project.status} compact />
        </div>
        <div>
          <p className="m-0 block text-body2 text-fg-muted">Resources</p>
          <p className="m-0 text-body2">{project.resourcesCount}</p>
        </div>
        <div>
          <p className="m-0 block text-body2 text-fg-muted">Golden State</p>
          {project.goldenState ? (
            <Label
              tone={getScoreChipColor(project.goldenState.score)}
              label={`${project.goldenState.score}%`}
            />
          ) : (
            <p className="m-0 text-body2">-</p>
          )}
        </div>
        <div>
          <p className="m-0 block text-body2 text-fg-muted">Last Updated</p>{" "}
          <RelativeTime date={project.updatedAt} />
        </div>
      </>
    );
  };

  if (error) {
    return (
      <PageContainer
        title="Projects"
        icon={entityIcons.project}
        actions={actions}
      >
        <div className="w-full py-8">
          <Alert className="mb-4" severity="error">
            {error}
          </Alert>
          <Button onClick={fetchProjects}>Retry</Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Projects"
      icon={entityIcons.project}
      description={
        <>
          <Link
            href="https://opensource.electrolux.one/infrakitchen/concepts/project"
            target="_blank"
            rel="noopener"
            color="inherit"
            className="decoration-current"
          >
            Projects
          </Link>{" "}
          group related resources under shared defaults and access rules.
        </>
      }
      actions={actions}
    >
      <div className="w-full">
        <FilterProvider
          columns={projectColumns}
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
        ) : projects.length === 0 ? (
          <div className="py-8 text-center">
            <p className="m-0 text-h5">No projects match your filters</p>
          </div>
        ) : (
          <div className="mt-6 grid w-full grid-cols-[repeat(auto-fill,_minmax(var(--card-min-width),_1fr))] gap-4 [--card-min-width:240px] sm:[--card-min-width:260px] md:[--card-min-width:300px]">
            {projects.map((project) => (
              <EntityCard
                key={project.id}
                entity_name={entityName}
                name={project.name}
                description={project.description ?? ""}
                status={project.status}
                detailsUrl={`${linkPrefix}projects/${project.id}`}
                labels={project.labels || []}
                lastUpdated={project.updatedAt}
                entityFields={projectCardFields(project)}
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

ProjectsPage.path = "projects";
