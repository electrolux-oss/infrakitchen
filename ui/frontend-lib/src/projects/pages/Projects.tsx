import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Typography,
} from "@mui/material";

import { FilterProvider, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/EntityCard";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
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
    <Box>
      <PermissionWrapper
        requiredPermission="api:project"
        permissionAction="write"
      >
        <Button
          variant="outlined"
          onClick={() => navigate(`${linkPrefix}projects/create`)}
          startIcon={<AddIcon />}
        >
          Create
        </Button>
      </PermissionWrapper>
    </Box>
  );

  const projectCardFields = (project: GqlProject) => {
    return (
      <>
        <Box>
          <Typography variant="caption" sx={{ display: "block" }}>
            Status
          </Typography>
          <StatusChip status={project.status} compact />
        </Box>
        <Box>
          <Typography variant="caption" sx={{ display: "block" }}>
            Resources
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            {project.resourcesCount}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ display: "block" }}>
            Last Updated
          </Typography>
          <RelativeTime
            date={project.updatedAt}
            variant="caption"
            sx={{ fontWeight: 500 }}
          />
        </Box>
      </>
    );
  };

  if (error) {
    return (
      <PageContainer title="Projects" actions={actions}>
        <Box sx={{ width: "100%", py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="outlined" onClick={fetchProjects}>
            Retry
          </Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Projects"
      description={
        <>
          <Link
            href="https://opensource.electrolux.one/infrakitchen/core-concepts/projects/overview/"
            target="_blank"
            rel="noopener"
            sx={{ color: "inherit", textDecoration: "underline" }}
          >
            Projects
          </Link>{" "}
          group related resources under shared defaults and access rules.
        </>
      }
      actions={actions}
    >
      <Box sx={{ width: "100%" }}>
        <FilterProvider
          columns={projectColumns}
          storageKey={`filter_${entityName}s`}
          onFilterChange={handleFilterChange}
          syncToUrl
        >
          <FilterPanel />
        </FilterProvider>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "50vh",
            }}
          >
            <CircularProgress />
          </Box>
        ) : projects.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="h5" component="p">
              No projects match your filters
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              "--card-min-width": { xs: "260px", sm: "300px", md: "340px" },
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(var(--card-min-width), 1fr))",
              gap: 3,
              width: "100%",
              alignItems: "stretch",
              mt: 4,
            }}
          >
            {projects.map((project) => (
              <EntityCard
                key={project.id}
                entity_name={entityName}
                name={project.name}
                description={project.description || "No description"}
                status={project.status}
                detailsUrl={`${linkPrefix}projects/${project.id}`}
                labels={project.labels || []}
                lastUpdated={project.updatedAt}
                entityFields={projectCardFields(project)}
              />
            ))}
          </Box>
        )}
      </Box>
    </PageContainer>
  );
};

ProjectsPage.path = "projects";
