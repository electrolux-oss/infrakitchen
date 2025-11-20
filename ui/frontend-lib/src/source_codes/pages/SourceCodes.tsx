import { useState, useCallback, useEffect, useMemo } from "react";

import { useNavigate } from "react-router";

import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";

import { IconField, FilterConfig } from "../../common";
import { EntityCard } from "../../common/components/EntityCard";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import {
  formatTimeAgo,
  getProviderDisplayName,
  getRepoNameFromUrl,
} from "../../common/utils";
import { SourceCodeResponse } from "../types";

export const SourceCodesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const [sourceCodes, setSourceCodes] = useState<SourceCodeResponse[]>([]);
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
        setSourceCodes(response.data || []);
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

  const filteredSourceCodes = useMemo(
    () =>
      sourceCodes.filter((sourceCode) => {
        const s = (filterValues.name || "").toLowerCase();
        return (
          !s ||
          sourceCode.identifier.toLowerCase().includes(s) ||
          sourceCode.description.toLowerCase().includes(s)
        );
      }),
    [sourceCodes, filterValues.name],
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
    <Button
      variant="outlined"
      onClick={() => navigate(`${linkPrefix}source_codes/create`)}
    >
      Import
    </Button>
  );

  const sourceCodeCardFields = (sourceCode: SourceCodeResponse) => {
    return (
      <>
        <Box>
          <Typography variant="caption" sx={{ display: "block" }}>
            Provider
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {IconField(sourceCode.source_code_provider)}
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              {getProviderDisplayName(sourceCode.source_code_provider)}
            </Typography>
          </Box>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ display: "block" }}>
            Status
          </Typography>
          <StatusChip status={sourceCode.status} />
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="caption" sx={{ display: "block" }}>
            Last Updated
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            {formatTimeAgo(sourceCode.updated_at)}
          </Typography>
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
        {filteredSourceCodes.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="h5">
              {sourceCodes.length === 0
                ? "No source codes available"
                : "No source codes match your filters"}
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
            {filteredSourceCodes.map((sourceCode) => (
              <EntityCard
                key={sourceCode.id}
                name={getRepoNameFromUrl(sourceCode.source_code_url)}
                description={sourceCode.description}
                detailsUrl={`${linkPrefix}source_codes/${sourceCode.id}`}
                createUrl={`${linkPrefix}source_code_versions/create`}
                labels={sourceCode.labels}
                createButtonName={"Create Version"}
                entityFields={sourceCodeCardFields(sourceCode)}
              />
            ))}
          </Box>
        )}
      </Box>
    </PageContainer>
  );
};

SourceCodesPage.path = "/source_codes";
