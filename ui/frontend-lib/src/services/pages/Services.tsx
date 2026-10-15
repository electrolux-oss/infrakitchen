import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router";

import { FilterProvider, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/cards/EntityCard";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { AddIcon } from "../../icons/material";
import { Alert, Spinner, Button } from "../../ui";
import { serviceColumns } from "../components/serviceTableConfig";
import { GqlService, SERVICES_QUERY } from "../graphql";

export const ServicesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const [services, setServices] = useState<GqlService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const navigate = useNavigate();

  const entityName = "service";

  const fetchServices = useCallback(async () => {
    const apiFilters = buildAdvancedApiFilters(filterValues);

    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await ikApi.graphqlRequest<{
        services: GqlService[];
      }>(SERVICES_QUERY, {
        filter: Object.keys(apiFilters).length > 0 ? apiFilters : null,
        sort: ["name", "ASC"],
        range: [0, 1000],
      });
      setServices(response.services || []);
      setIsInitialLoad(false);
    } catch (error: any) {
      setError(error.message || "Failed to fetch services");
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
    fetchServices();
  }, [fetchServices]);

  const actions = (
    <div>
      <PermissionWrapper
        requiredPermission="api:service"
        permissionAction="write"
      >
        <Button
          onClick={() => navigate(`${linkPrefix}services/create`)}
          startIcon={<AddIcon />}
        >
          Create
        </Button>
      </PermissionWrapper>
    </div>
  );

  const serviceCardFields = (service: GqlService) => {
    return (
      <>
        <div>
          <p className="m-0 block text-body2 text-fg-muted">Last Updated</p>{" "}
          <RelativeTime date={service.updatedAt} />
        </div>
      </>
    );
  };

  if (error) {
    return (
      <PageContainer title="Services" actions={actions}>
        <div className="w-full py-8">
          <Alert className="mb-4" severity="error">
            {error}
          </Alert>
          <Button onClick={fetchServices}>Retry</Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Services"
      description="Services describe what runs inside a project and who owns it."
      actions={actions}
    >
      <div className="w-full">
        <FilterProvider
          columns={serviceColumns}
          storageKey={`filter_${entityName}s`}
          onFilterChange={handleFilterChange}
          syncToUrl
        >
          <FilterPanel />
        </FilterProvider>
        {loading ? (
          <div className="flex h-[50vh] items-center justify-center">
            <Spinner />
          </div>
        ) : services.length === 0 ? (
          <div className="py-8 text-center">
            <p className="m-0 text-h5">No services match your filters</p>
          </div>
        ) : (
          <div className="mt-6 grid w-full grid-cols-[repeat(auto-fill,_minmax(var(--card-min-width),_1fr))] gap-4 [--card-min-width:240px] sm:[--card-min-width:260px] md:[--card-min-width:300px]">
            {services.map((service) => (
              <EntityCard
                key={service.id}
                entity_name={entityName}
                name={service.displayName || service.name}
                description={service.description ?? ""}
                detailsUrl={`${linkPrefix}services/${service.id}`}
                labels={service.labels || []}
                lastUpdated={service.updatedAt}
                entityFields={serviceCardFields(service)}
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

ServicesPage.path = "services";
