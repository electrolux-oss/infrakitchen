import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";

import { CascadingOption, FilterConfig, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/EntityCard";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { providers } from "../constants";
import { ConnectionType, IntegrationResponse, IntegrationType } from "../types";

const IntegrationsPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  const [integrations, setIntegrations] = useState<IntegrationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [submenuAnchor, setSubmenuAnchor] = useState<null | HTMLElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const fetchIntegrations = useCallback(() => {
    setLoading(true);
    setError(null);
    ikApi
      .getList("integrations", {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "name", order: "ASC" },
        filter: {},
      })
      .then(({ data }) => {
        setIntegrations(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load integrations");
        notifyError(err);
        setLoading(false);
      });
  }, [ikApi]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleFilterChange = useCallback(
    (newFilterValues: Record<string, any>) => {
      setFilterValues(newFilterValues);
    },
    [],
  );

  const allProviders = useMemo(
    () =>
      providers
        .filter((p) => p.connectionType !== ConnectionType.SSH)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const cascadingOptions = useMemo<CascadingOption[]>(
    () => [
      {
        label: "Git",
        value: IntegrationType.GIT,
        children: allProviders
          .filter((p) => p.type === IntegrationType.GIT)
          .map((p) => ({ label: p.name, value: p.slug })),
      },
      {
        label: "Cloud",
        value: IntegrationType.CLOUD,
        children: allProviders
          .filter((p) => p.type === IntegrationType.CLOUD)
          .map((p) => ({ label: p.name, value: p.slug })),
      },
    ],
    [allProviders],
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
        id: "type_provider",
        type: "cascading" as const,
        label: "Provider",
        options: cascadingOptions,
        width: 320,
      },
    ],
    [cascadingOptions],
  );

  const filtered = useMemo(() => {
    const searchTerm = (filterValues.name || "").toLowerCase();
    const typeProviderFilter = filterValues.type_provider ?? null;
    const selectedType: IntegrationType | null = Array.isArray(
      typeProviderFilter,
    )
      ? (typeProviderFilter[0] as IntegrationType)
      : typeProviderFilter
        ? (typeProviderFilter as IntegrationType)
        : null;
    const selectedProviderSlug: string | null = Array.isArray(
      typeProviderFilter,
    )
      ? (typeProviderFilter[1] ?? null)
      : null;

    return integrations
      .filter((i) => !selectedType || i.integration_type === selectedType)
      .filter(
        (i) =>
          !searchTerm ||
          i.name.toLowerCase().includes(searchTerm) ||
          (i.description || "").toLowerCase().includes(searchTerm),
      )
      .filter((i) => {
        if (!selectedProviderSlug) return true;
        return (
          i.integration_provider === selectedProviderSlug ||
          i.integration_provider === `${selectedProviderSlug}_ssh`
        );
      });
  }, [integrations, filterValues]);

  const integrationEntityFields = (integration: IntegrationResponse) => (
    <>
      <Box>
        <Typography variant="caption" sx={{ display: "block" }}>
          Status
        </Typography>
        <StatusChip status={integration.status} compact />
      </Box>
      <Box>
        <Typography variant="caption" sx={{ display: "block" }}>
          Last Updated
        </Typography>
        <RelativeTime
          date={integration.updated_at}
          variant="caption"
          sx={{ fontWeight: 500 }}
        />
      </Box>
    </>
  );

  const closeAllMenus = () => {
    setMenuAnchor(null);
    setSubmenuAnchor(null);
    setActiveCategory(null);
  };

  const actions = (
    <PermissionWrapper
      requiredPermission="api:integration"
      permissionAction="write"
    >
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={(e) => setMenuAnchor(e.currentTarget)}
      >
        Connect
      </Button>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeAllMenus}
      >
        {cascadingOptions.map((category) => (
          <MenuItem
            key={category.value}
            onClick={(e) => {
              setSubmenuAnchor(e.currentTarget);
              setActiveCategory(String(category.value));
            }}
            selected={activeCategory === String(category.value)}
          >
            <ListItemText>{category.label}</ListItemText>
            <ArrowRightIcon fontSize="small" sx={{ ml: 1 }} />
          </MenuItem>
        ))}
      </Menu>
      <Menu
        anchorEl={submenuAnchor}
        open={Boolean(submenuAnchor)}
        onClose={closeAllMenus}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        {cascadingOptions
          .find((c) => String(c.value) === activeCategory)
          ?.children?.map((child) => {
            const provider = allProviders.find((p) => p.slug === child.value);
            return (
              <MenuItem
                key={String(child.value)}
                onClick={() => {
                  closeAllMenus();
                  navigate(`${linkPrefix}integrations/${child.value}/setup`);
                }}
              >
                {provider && (
                  <ListItemIcon>
                    <provider.icon width="20" height="20" />
                  </ListItemIcon>
                )}
                <ListItemText>{child.label}</ListItemText>
              </MenuItem>
            );
          })}
      </Menu>
    </PermissionWrapper>
  );

  if (error) {
    return (
      <PageContainer title="Integrations" actions={actions}>
        <Box sx={{ width: "100%", py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="outlined" onClick={fetchIntegrations}>
            Retry
          </Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Integrations" actions={actions}>
      <Box sx={{ width: "100%" }}>
        <FilterPanel
          filters={filterConfigs}
          storageKey="filter_integrations"
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
        ) : filtered.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              py: 6,
            }}
          >
            {integrations.length === 0 ? (
              <>
                <Typography variant="h5" component="p" color="text.secondary">
                  No integrations connected yet
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    gap: 2,
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  {allProviders.map((p) => (
                    <Button
                      key={p.slug}
                      variant="outlined"
                      startIcon={<p.icon width="20" height="20" />}
                      onClick={() =>
                        navigate(`${linkPrefix}integrations/${p.slug}/setup`)
                      }
                    >
                      Connect {p.name}
                    </Button>
                  ))}
                </Box>
              </>
            ) : (
              <Typography variant="h5" component="p" color="text.secondary">
                No integrations match your filters
              </Typography>
            )}
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
            {filtered.map((integration) => {
              const provider = providers.find(
                (p) =>
                  integration.integration_provider === p.slug ||
                  integration.integration_provider === `${p.slug}_ssh`,
              );
              return (
                <EntityCard
                  key={integration.id}
                  entity_name="integration"
                  name={integration.name}
                  description={integration.description || ""}
                  status={integration.status}
                  detailsUrl={`${linkPrefix}integrations/${provider?.slug}/${integration.id}`}
                  labels={integration.labels}
                  icon={
                    provider ? (
                      <provider.icon width="40" height="40" />
                    ) : undefined
                  }
                  entityFields={integrationEntityFields(integration)}
                />
              );
            })}
          </Box>
        )}
      </Box>
    </PageContainer>
  );
};

IntegrationsPage.path = "/integrations";

export { IntegrationsPage };
