import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router";

import InputIcon from "@mui/icons-material/Input";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";

import { FilterProvider, IconField, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/EntityCard";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { getRepoNameFromUrl } from "../../common/utils";
import { sourceCodeColumns } from "../components/sourceCodeTableConfig";
import { GqlSourceCode, SOURCE_CODES_QUERY } from "../graphql";

export const SourceCodesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const [repositories, setRepositories] = useState<GqlSourceCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const navigate = useNavigate();

  const entityName = "source_code";

  const handleFilterChange = useCallback(
    (newFilterValues: Record<string, any>) => {
      setFilterValues(newFilterValues);
    },
    [],
  );

  const fetchSourceCodes = useCallback(() => {
    const apiFilters = buildAdvancedApiFilters(filterValues);

    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    ikApi
      .graphqlRequest<{
        sourceCodes: GqlSourceCode[];
      }>(SOURCE_CODES_QUERY, {
        filter: Object.keys(apiFilters).length > 0 ? apiFilters : null,
        sort: ["updated_at", "DESC"],
        range: [0, 1000],
      })
      .then((response) => {
        setRepositories(response.sourceCodes || []);
        setIsInitialLoad(false);
      })
      .catch((e: any) => {
        setError(e.message || "Failed to fetch Source Codes");
        notifyError(e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ikApi, filterValues, isInitialLoad]);

  // Fetch data when component mounts or when label filter changes
  useEffect(() => {
    fetchSourceCodes();
  }, [fetchSourceCodes]);

  const actions = (
    <PermissionWrapper
      requiredPermission="api:source_code"
      permissionAction="write"
    >
      <Button
        variant="outlined"
        onClick={() => navigate(`${linkPrefix}source_codes/create`)}
        startIcon={<InputIcon />}
      >
        Import
      </Button>
    </PermissionWrapper>
  );

  const repositoryCardFields = (repository: GqlSourceCode) => {
    return (
      <>
        <Box>
          <Typography variant="caption" sx={{ display: "block" }}>
            Status
          </Typography>
          <StatusChip status={repository.status} compact />
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="caption" sx={{ display: "block" }}>
            Last Updated
          </Typography>
          <RelativeTime
            date={repository.updatedAt}
            variant="caption"
            sx={{ fontWeight: 500 }}
          />
        </Box>
      </>
    );
  };

  if (loading) {
    return (
      <PageContainer title="Code Repositories" actions={actions}>
        <Box sx={{ width: "100%", py: 4 }}>
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
        </Box>
      </PageContainer>
    );
  }
  if (error) {
    return (
      <PageContainer title="Code Repositories" actions={actions}>
        <Box sx={{ width: "100%", py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="outlined" onClick={fetchSourceCodes}>
            Retry
          </Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Code Repositories" actions={actions}>
      <Box sx={{ width: "100%" }}>
        <FilterProvider
          columns={sourceCodeColumns}
          storageKey={`filter_${entityName}s`}
          onFilterChange={handleFilterChange}
          syncToUrl
        >
          <FilterPanel />
        </FilterProvider>
        {repositories.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="h5">
              No code repositories match your filters
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
            {repositories.map((repository) => (
              <EntityCard
                key={repository.id}
                entity_name="source_code"
                icon={
                  <Box sx={{ fontSize: 32 }}>
                    {IconField(repository.sourceCodeProvider)}
                  </Box>
                }
                name={getRepoNameFromUrl(repository.sourceCodeUrl)}
                description={repository.description || "No description"}
                detailsUrl={`${linkPrefix}source_codes/${repository.id}`}
                labels={repository.labels || []}
                lastUpdated={repository.updatedAt}
                entityFields={repositoryCardFields(repository)}
              />
            ))}
          </Box>
        )}
      </Box>
    </PageContainer>
  );
};

SourceCodesPage.path = "/source_codes";
