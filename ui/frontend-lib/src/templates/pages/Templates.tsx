import React, { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import InputIcon from "@mui/icons-material/Input";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ReorderIcon from "@mui/icons-material/Reorder";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
  Link,
} from "@mui/material";

import { FilterProvider, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/EntityCard";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { buildEntityActionMutation } from "../../common/graphql/entityActionMutation";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { TemplateVersionReorderDialog } from "../../source_code_versions/components/TemplateVersionReorderDialog";
import { ENTITY_ACTION, ENTITY_STATUS } from "../../utils/constants";
import { templateColumns } from "../components/templateFilterConfig";
import { GqlTemplate, TEMPLATE_LIST_FIELDS } from "../graphql";

const TEMPLATE_ACTION_MUTATION = buildEntityActionMutation("template");

export const TemplatesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const [templates, setTemplates] = useState<GqlTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [reorderTemplate, setReorderTemplate] = useState<GqlTemplate | null>(
    null,
  );
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuTemplate, setMenuTemplate] = useState<GqlTemplate | null>(null);
  const [togglingTemplateId, setTogglingTemplateId] = useState<string | null>(
    null,
  );
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

  const handleOpenMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, template: GqlTemplate) => {
      setMenuAnchorEl(event.currentTarget);
      setMenuTemplate(template);
    },
    [],
  );

  const handleCloseMenu = useCallback(() => {
    setMenuAnchorEl(null);
    setMenuTemplate(null);
  }, []);

  const handleToggleTemplateEnabled = useCallback(
    async (template: GqlTemplate) => {
      const action =
        template.status?.toLocaleLowerCase() === ENTITY_STATUS.DISABLED
          ? ENTITY_ACTION.ENABLE
          : ENTITY_ACTION.DISABLE;

      setTogglingTemplateId(template.id);
      handleCloseMenu();

      try {
        await ikApi.graphqlRequest(TEMPLATE_ACTION_MUTATION, {
          id: template.id,
          input: { action },
        });
        notify(
          action === ENTITY_ACTION.ENABLE
            ? "Template enabled"
            : "Template disabled",
          "success",
        );
        await fetchTemplates();
      } catch (error) {
        notifyError(error);
      } finally {
        setTogglingTemplateId(null);
      }
    },
    [fetchTemplates, handleCloseMenu, ikApi],
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
          variant="outlined"
          onClick={() => navigate(`${linkPrefix}templates/create`)}
          startIcon={<AddIcon />}
        >
          Create
        </Button>
        <Button
          variant="outlined"
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
          <Typography variant="caption" sx={{ display: "block" }}>
            Status
          </Typography>
          <StatusChip status={template.status} compact />
        </Box>
        <Box>
          <Typography variant="caption" sx={{ display: "block" }}>
            Last Updated
          </Typography>
          <RelativeTime
            date={template.updatedAt}
            variant="caption"
            sx={{ fontWeight: 500 }}
          />
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
          <Button variant="outlined" onClick={fetchTemplates}>
            Retry
          </Button>
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
            {templates.map((template) => {
              const enabled = template.status !== "disabled";

              return (
                <EntityCard
                  key={template.id}
                  entity_name="template"
                  name={template.name}
                  description={template.description || "No description"}
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
                  chip={template.abstract ? "Abstract" : undefined}
                  lastUpdated={template.updatedAt}
                  entityFields={templateCardFields(template)}
                  headerAction={
                    <PermissionWrapper
                      requiredPermission="api:template"
                      permissionAction="write"
                    >
                      <IconButton
                        size="small"
                        aria-label={`Open actions for ${template.name}`}
                        aria-controls={
                          menuTemplate?.id === template.id
                            ? "template-actions-menu"
                            : undefined
                        }
                        aria-haspopup="true"
                        aria-expanded={
                          menuTemplate?.id === template.id ? "true" : undefined
                        }
                        onClick={(event) => handleOpenMenu(event, template)}
                        disabled={togglingTemplateId === template.id}
                        sx={{ mt: -0.5, mr: -0.5 }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </PermissionWrapper>
                  }
                />
              );
            })}
          </Box>
        )}
      </Box>

      <Menu
        id="template-actions-menu"
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl && menuTemplate)}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {menuTemplate && !menuTemplate.abstract ? (
          <PermissionWrapper
            requiredPermission="api:source_code_version"
            permissionAction="write"
          >
            <MenuItem
              onClick={() => {
                setReorderTemplate(menuTemplate);
                handleCloseMenu();
              }}
            >
              <ListItemIcon>
                <ReorderIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Rearrange Versions</ListItemText>
            </MenuItem>
          </PermissionWrapper>
        ) : null}
        {menuTemplate ? (
          <PermissionWrapper
            requiredPermission="api:template"
            permissionAction="write"
          >
            <MenuItem
              onClick={() => void handleToggleTemplateEnabled(menuTemplate)}
              disabled={togglingTemplateId === menuTemplate.id}
            >
              <ListItemIcon>
                {menuTemplate.status?.toLocaleLowerCase() ===
                ENTITY_STATUS.DISABLED ? (
                  <ToggleOffIcon fontSize="small" />
                ) : (
                  <ToggleOnIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText>
                {menuTemplate.status?.toLocaleLowerCase() ===
                ENTITY_STATUS.DISABLED
                  ? "Enable"
                  : "Disable"}
              </ListItemText>
            </MenuItem>
          </PermissionWrapper>
        ) : null}
      </Menu>
      {reorderTemplate ? (
        <TemplateVersionReorderDialog
          open
          templateId={reorderTemplate.id}
          templateName={reorderTemplate.name}
          onClose={() => setReorderTemplate(null)}
          onSaved={() => fetchTemplates()}
        />
      ) : null}
    </PageContainer>
  );
};

TemplatesPage.path = "/templates";
