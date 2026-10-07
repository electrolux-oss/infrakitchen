import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";

import { FilterProvider, PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/cards/EntityCard";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
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
    <Box>
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
    </Box>
  );

  const serviceCardFields = (service: GqlService) => {
    return (
      <>
        <Box>
          <Typography sx={{ display: "block", color: "text.secondary" }}>
            Last Updated
          </Typography>{" "}
          <RelativeTime date={service.updatedAt} />
        </Box>
      </>
    );
  };

  if (error) {
    return (
      <PageContainer title="Services" actions={actions}>
        <Box sx={{ width: "100%", py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button onClick={fetchServices}>Retry</Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Services"
      description="Services describe what runs inside a project and who owns it."
      actions={actions}
    >
      <Box sx={{ width: "100%" }}>
        <FilterProvider
          columns={serviceColumns}
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
        ) : services.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="h5" component="p">
              No services match your filters
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              "--card-min-width": { xs: "240px", sm: "260px", md: "300px" },
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(var(--card-min-width), 1fr))",
              gap: 2,
              width: "100%",
              mt: 3,
            }}
          >
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
          </Box>
        )}
      </Box>
    </PageContainer>
  );
};

ServicesPage.path = "services";
