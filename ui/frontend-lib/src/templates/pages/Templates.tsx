import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";

import { FilterConfig } from "../../common";
import { EntityCard } from "../../common/components/EntityCard";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { TemplateResponse } from "../types";

export const TemplatesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const navigate = useNavigate();

  const entityName = "template";

  const fetchTemplates = useCallback(async () => {
    const apiFilters: Record<string, any> = {};
    if (filterValues.labels && filterValues.labels.length > 0) {
      apiFilters["labels__contains_all"] = filterValues.labels;
    }

    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await ikApi.getList("templates", {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "name", order: "ASC" },
        filter: apiFilters,
      });
      setTemplates(response.data || []);
      setIsInitialLoad(false);
    } catch (error: any) {
      setError(error.message || "Failed to fetch templates");
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
    ikApi.get("labels/template").then((response: string[]) => {
      setLabels(response);
    });
  }, [ikApi]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filteredTemplates = useMemo(
    () =>
      templates.filter((t) => {
        const s = (filterValues.name || "").toLowerCase();
        return (
          !s ||
          t.name.toLowerCase().includes(s) ||
          t.description.toLowerCase().includes(s)
        );
      }),
    [templates, filterValues.name],
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
      <Button
        variant="outlined"
        onClick={() => navigate(`${linkPrefix}templates/create`)}
      >
        Create
      </Button>
      <Button
        variant="outlined"
        onClick={() => navigate(`${linkPrefix}templates/import`)}
        sx={{ ml: 1 }}
      >
        Import
      </Button>
    </Box>
  );

  const templateCardFields = (template: TemplateResponse) => {
    return (
      <>
        <Box>
          <Typography variant="caption" sx={{ display: "block" }}>
            Last Updated
          </Typography>
          <RelativeTime
            date={template.updated_at}
            variant="caption"
            sx={{ fontWeight: 500 }}
          />
        </Box>
      </>
    );
  };

  if (error) {
    return (
      <PageContainer title="Infrastructure Templates" actions={actions}>
        <Box sx={{ width: "100%", py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="outlined" onClick={fetchTemplates}>
            Retry
          </Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Infrastructure Templates" actions={actions}>
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
        ) : filteredTemplates.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="h5" component="p">
              No templates available
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
            {filteredTemplates.map((template) => {
              const enabled = template.status !== "disabled";
              return (
                <EntityCard
                  key={template.id}
                  name={template.name}
                  description={template.description}
                  status={template.status}
                  detailsUrl={`${linkPrefix}templates/${template.id}`}
                  {...(enabled && {
                    onCreateClick: () =>
                      navigate(`${linkPrefix}resources/create`, {
                        state: { template_id: template.id },
                      }),
                  })}
                  {...(enabled ? { createButtonName: "Create Resource" } : {})}
                  labels={template.labels}
                  entityFields={templateCardFields(template)}
                />
              );
            })}
          </Box>
        )}
      </Box>
    </PageContainer>
  );
};

TemplatesPage.path = "/templates";
