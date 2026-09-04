import React, { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import InputIcon from "@mui/icons-material/Input";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
  Link,
} from "@mui/material";

import { FilterProvider, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/EntityCard";
import { entityCardGridSx } from "../../common/utils/entityCardGrid";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
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
    <Box>
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
          onClick={() => navigate(`${linkPrefix}templates/import`)}
          sx={{ ml: 1 }}
          startIcon={<InputIcon />}
        >
          Import
        </Button>
      </PermissionWrapper>
    </Box>
  );

  const templateCardFields = (template: GqlTemplate) => {
    return (
      <>
        <Box>
          <Typography sx={{ display: "block", color: "text.secondary" }}>
            Status
          </Typography>
          <StatusChip status={template.status} compact />
        </Box>
        <Box>
          <Typography sx={{ display: "block", color: "text.secondary" }}>
            Last Updated
          </Typography>{" "}
          <RelativeTime date={template.updatedAt} />
        </Box>
      </>
    );
  };

  if (error) {
    return (
      <PageContainer title="Templates" actions={actions}>
        <Box sx={{ width: "100%", py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button onClick={fetchTemplates}>Retry</Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Templates"
      description={
        <>
          <Link
            href="https://opensource.electrolux.one/infrakitchen/core-concepts/templates/overview/"
            target="_blank"
            rel="noopener"
            sx={{ color: "inherit", textDecoration: "underline" }}
          >
            Templates
          </Link>{" "}
          are versioned, reusable building blocks that enable consistent
          self-service infrastructure provisioning and management.
        </>
      }
      actions={actions}
    >
      <Box sx={{ width: "100%" }}>
        <FilterProvider
          columns={templateColumns}
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
        ) : templates.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="h5" component="p">
              No templates available
            </Typography>
          </Box>
        ) : (
          <Box sx={{ ...entityCardGridSx(), mt: 3 }}>
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
          </Box>
        )}
      </Box>
    </PageContainer>
  );
};

TemplatesPage.path = "/templates";
