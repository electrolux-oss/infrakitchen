import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
} from "@mui/material";

import { FilterConfig, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/EntityCard";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { BlueprintResponse } from "../types";

export const BlueprintsPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const [blueprints, setBlueprints] = useState<BlueprintResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const navigate = useNavigate();

  const entityName = "blueprint";

  const fetchBlueprints = useCallback(async () => {
    const apiFilters: Record<string, any> = {};
    if (filterValues.labels && filterValues.labels.length > 0) {
      apiFilters["labels__contains_all"] = filterValues.labels;
    }

    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await ikApi.getList("blueprints", {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "name", order: "ASC" },
        filter: apiFilters,
      });
      setBlueprints(response.data || []);
      setIsInitialLoad(false);
    } catch (error: any) {
      setError(error.message || "Failed to fetch blueprints");
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [ikApi, filterValues.labels, isInitialLoad]);

  const handleFilterChange = useCallback(
    (newFilterValues: Record<string, any>) => {
      setFilterValues(newFilterValues);
    },
    [],
  );

  useEffect(() => {
    ikApi
      .get("labels/blueprint")
      .then((response: string[]) => {
        setLabels(response);
      })
      .catch(() => {
        // labels endpoint may not exist yet for blueprints
      });
  }, [ikApi]);

  useEffect(() => {
    fetchBlueprints();
  }, [fetchBlueprints]);

  const filteredBlueprints = useMemo(
    () =>
      blueprints.filter((b) => {
        const s = (filterValues.name || "").toLowerCase();
        return (
          !s ||
          b.name.toLowerCase().includes(s) ||
          (b.description || "").toLowerCase().includes(s)
        );
      }),
    [blueprints, filterValues.name],
  );

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
    <Box>
      <PermissionWrapper
        requiredPermission="api:blueprint"
        permissionAction="write"
      >
        <Button
          variant="outlined"
          onClick={() => navigate(`${linkPrefix}blueprints/create`)}
        >
          Create
        </Button>
      </PermissionWrapper>
    </Box>
  );

  const blueprintCardFields = (bp: BlueprintResponse) => {
    return (
      <>
        <Box>
          <Typography variant="caption" sx={{ display: "block" }}>
            Templates
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
            {bp.templates.slice(0, 3).map((t) => (
              <Chip key={t.id} label={t.name} size="small" variant="outlined" />
            ))}
            {bp.templates.length > 3 && (
              <Chip
                label={`+${bp.templates.length - 3}`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ display: "block" }}>
            Last Updated
          </Typography>
          <RelativeTime
            date={bp.updated_at}
            variant="caption"
            sx={{ fontWeight: 500 }}
          />
        </Box>
      </>
    );
  };

  if (error) {
    return (
      <PageContainer title="Blueprints" actions={actions}>
        <Box sx={{ width: "100%", py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="outlined" onClick={fetchBlueprints}>
            Retry
          </Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Blueprints" actions={actions}>
      <Box sx={{ width: "100%" }}>
        <FilterPanel
          filters={filterConfigs}
          storageKey={`filter_${entityName}s`}
          onFilterChange={handleFilterChange}
        />
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
        ) : filteredBlueprints.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="h5" component="p">
              No blueprints available
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
            {filteredBlueprints.map((bp) => (
              <EntityCard
                key={bp.id}
                entity_name="blueprint"
                name={bp.name}
                description={bp.description || ""}
                status={bp.status}
                detailsUrl={`${linkPrefix}blueprints/${bp.id}`}
                labels={bp.labels}
                entityFields={blueprintCardFields(bp)}
              />
            ))}
          </Box>
        )}
      </Box>
    </PageContainer>
  );
};

BlueprintsPage.path = "/blueprints";
