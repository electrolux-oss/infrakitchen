import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import InputIcon from "@mui/icons-material/Input";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";

import { FilterConfig, IconField, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/EntityCard";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { getRepoNameFromUrl } from "../../common/utils";
import { SourceCodeResponse } from "../types";

export const SourceCodesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const [repositories, setRepositories] = useState<SourceCodeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
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
    const apiFilters: Record<string, any> = {};
    if (filterValues.labels && filterValues.labels.length > 0) {
      apiFilters["labels__contains_all"] = filterValues.labels;
    }

    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    ikApi
      .getList("source_codes", {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "updated_at", order: "DESC" },
        filter: apiFilters,
        fields: [
          "id",
          "identifier",
          "description",
          "source_code_url",
          "source_code_provider",
          "status",
          "labels",
          "updated_at",
        ],
      })
      .then((response) => {
        setRepositories(response.data || []);
        setIsInitialLoad(false);
      })
      .catch((e: any) => {
        setError(e.message || "Failed to fetch Source Codes");
        notifyError(e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ikApi, filterValues.labels, isInitialLoad]);

  useEffect(() => {
    ikApi.get("labels/source_code").then((response: string[]) => {
      setLabels(response);
    });
  }, [ikApi]);

  // Fetch data when component mounts or when label filter changes
  useEffect(() => {
    fetchSourceCodes();
  }, [fetchSourceCodes]);

  const filteredRepositories = useMemo(
    () =>
      repositories.filter((repository) => {
        const s = (filterValues.name || "").toLowerCase();
        return (
          !s ||
          repository.identifier.toLowerCase().includes(s) ||
          repository.description.toLowerCase().includes(s)
        );
      }),
    [repositories, filterValues.name],
  );

  // Configure filters
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "name",
        type: "search" as const,
        label: "Search",
        width: 420,
      },
      {
        id: "labels",
        type: "autocomplete" as const,
        label: "Labels",
        options: labels,
        multiple: true,
        width: 420,
      },
    ],
    [labels],
  );

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

  const repositoryCardFields = (repository: SourceCodeResponse) => {
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
            date={repository.updated_at}
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
        <FilterPanel
          filters={filterConfigs}
          storageKey={`filter_${entityName}s`}
          onFilterChange={handleFilterChange}
        />
        {filteredRepositories.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="h5">
              {repositories.length === 0
                ? "No code repositories available"
                : "No code repositories match your filters"}
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
            {filteredRepositories.map((repository) => (
              <EntityCard
                key={repository.id}
                entity_name="source_code"
                icon={
                  <Box sx={{ fontSize: 32 }}>
                    {IconField(repository.source_code_provider)}
                  </Box>
                }
                name={getRepoNameFromUrl(repository.source_code_url)}
                description={repository.description}
                detailsUrl={`${linkPrefix}source_codes/${repository.id}`}
                labels={repository.labels}
                lastUpdated={repository.updated_at}
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
