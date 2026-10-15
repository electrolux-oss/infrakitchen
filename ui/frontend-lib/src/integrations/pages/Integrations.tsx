import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import { Icon } from "@iconify/react";
import octiconCloud24Data from "@iconify-icons/octicon/cloud-24";
import octiconGitBranch24Data from "@iconify-icons/octicon/git-branch-24";
import octiconReportData from "@iconify-icons/octicon/report";

import { FilterProvider, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/cards/EntityCard";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { ENTITY_CARD_GRID_CLASSES } from "../../common/utils/entityCardGrid";
import {
  Alert,
  Spinner,
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Link,
} from "../../ui";
import { cn } from "../../utils/cn";
import { integrationColumns } from "../components/integrationFilterConfig";
import { providers } from "../constants";
import { GqlIntegration, INTEGRATIONS_QUERY } from "../graphql";
import {
  ConnectionType,
  IntegrationType,
  integrationTypeChipColor,
} from "../types";

const IntegrationsPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  const [integrations, setIntegrations] = useState<GqlIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [submenuAnchor, setSubmenuAnchor] = useState<null | HTMLElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const fetchIntegrations = useCallback(() => {
    setLoading(true);
    setError(null);
    ikApi
      .graphqlRequest<{ integrations: GqlIntegration[] }>(INTEGRATIONS_QUERY, {
        filter: buildAdvancedApiFilters(filterValues),
        sort: ["name", "ASC"],
        range: [0, 1000],
      })
      .then((response) => {
        setIntegrations(response.integrations);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load integrations");
        notifyError(err);
        setLoading(false);
      });
  }, [ikApi, filterValues]);

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

  const providerGroups = useMemo<ProviderGroup[]>(
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
      {
        label: "Notification",
        value: IntegrationType.NOTIFICATION,
        children: allProviders
          .filter((p) => p.type === IntegrationType.NOTIFICATION)
          .map((p) => ({ label: p.name, value: p.slug })),
      },
    ],
    [allProviders],
  );

  const integrationEntityFields = (integration: GqlIntegration) => (
    <>
      <div>
        <p className="m-0 block text-body2 text-fg-muted">Status</p>
        <StatusChip status={integration.status} compact />
      </div>
      <div>
        <p className="m-0 block text-body2 text-fg-muted">Last Updated</p>{" "}
        <RelativeTime date={integration.updatedAt} />
      </div>
    </>
  );

  const closeAllMenus = () => {
    setSubmenuAnchor(null);
    setActiveCategory(null);
  };

  const actions = (
    <PermissionWrapper
      requiredPermission="api:integration"
      permissionAction="write"
    >
      <div className="flex gap-2">
        <Button
          startIcon={<Icon icon={octiconGitBranch24Data} ssr />}
          onClick={(e) => {
            setSubmenuAnchor(e.currentTarget);
            setActiveCategory(String(IntegrationType.GIT));
          }}
        >
          Connect Git
        </Button>
        <Button
          startIcon={<Icon icon={octiconCloud24Data} ssr />}
          onClick={(e) => {
            setSubmenuAnchor(e.currentTarget);
            setActiveCategory(String(IntegrationType.CLOUD));
          }}
        >
          Connect Cloud
        </Button>
        <Button
          startIcon={<Icon icon={octiconReportData} ssr />}
          onClick={(e) => {
            setSubmenuAnchor(e.currentTarget);
            setActiveCategory(String(IntegrationType.NOTIFICATION));
          }}
        >
          Connect Notification
        </Button>
      </div>
      <Menu
        anchorEl={submenuAnchor}
        open={Boolean(submenuAnchor)}
        onClose={closeAllMenus}
      >
        {providerGroups
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
        <div className="w-full py-8">
          <Alert className="mb-4" severity="error">
            {error}
          </Alert>{" "}
          <Button onClick={fetchIntegrations}>Retry</Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Integrations"
      description={
        <>
          Manage your Git and Cloud{" "}
          <Link
            href="https://opensource.electrolux.one/infrakitchen/integrations/overview/"
            target="_blank"
            rel="noopener"
            color="inherit"
            className="decoration-current"
          >
            integrations
          </Link>
          .{" "}
          <span style={{ fontStyle: "italic", fontSize: "0.9em" }}>
            Need another one?{" "}
            <Link
              href="https://github.com/electrolux-oss/infrakitchen/issues"
              target="_blank"
              rel="noopener"
              color="inherit"
              className="decoration-current"
            >
              Let us know
            </Link>
            !
          </span>
        </>
      }
      actions={actions}
    >
      <div className="w-full">
        <FilterProvider
          columns={integrationColumns}
          storageKey="filter_integrations"
          onFilterChange={handleFilterChange}
          syncToUrl
        >
          <FilterPanel />
        </FilterProvider>
        {loading ? (
          <div className="flex h-[50vh] items-center justify-center">
            <Spinner />
          </div>
        ) : integrations.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-12">
            {integrations.length === 0 ? (
              <>
                <p className="m-0 text-h5 text-fg-muted">
                  No integrations connected yet
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  {" "}
                  {allProviders.map((p) => (
                    <Button
                      key={p.slug}
                      startIcon={<p.icon width="20" height="20" />}
                      onClick={() =>
                        navigate(`${linkPrefix}integrations/${p.slug}/setup`)
                      }
                    >
                      Connect {p.name}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p className="m-0 text-h5 text-fg-muted">
                No integrations match your filters
              </p>
            )}
          </div>
        ) : (
          <div className={cn(ENTITY_CARD_GRID_CLASSES, "mt-8")}>
            {integrations.map((integration) => {
              const provider = providers.find(
                (p) =>
                  integration.integrationProvider === p.slug ||
                  integration.integrationProvider === `${p.slug}_ssh`,
              );
              return (
                <EntityCard
                  key={integration.id}
                  entity_name="integration"
                  name={integration.name}
                  description={integration.description || ""}
                  status={integration.status}
                  detailsUrl={`${linkPrefix}integrations/${provider?.slug}/${integration.id}`}
                  lastUpdated={integration.updatedAt}
                  labels={integration.labels || []}
                  icon={
                    provider ? (
                      <provider.icon width="32" height="32" />
                    ) : undefined
                  }
                  chip={integration.integrationType}
                  chipColor={integrationTypeChipColor(
                    integration.integrationType,
                  )}
                  entityFields={integrationEntityFields(integration)}
                />
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

IntegrationsPage.path = "/integrations";

export { IntegrationsPage };
type ProviderGroup = {
  label: string;
  value: string;
  children?: Array<{ label: string; value: string }>;
};
