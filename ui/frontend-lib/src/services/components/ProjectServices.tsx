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

import { PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/cards/EntityCard";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import { GqlService, SERVICES_QUERY } from "../graphql";

interface ProjectServicesProps {
  projectId: string;
}

export const ProjectServices = ({ projectId }: ProjectServicesProps) => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const [services, setServices] = useState<GqlService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ikApi.graphqlRequest<{ services: GqlService[] }>(
        SERVICES_QUERY,
        {
          filter: { project_id: [projectId] },
          sort: ["name", "ASC"],
          range: [0, 1000],
        },
      );
      setServices(response.services || []);
    } catch (error: any) {
      setError(error.message || "Failed to fetch services");
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [ikApi, projectId]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const serviceCardFields = (service: GqlService) => {
    return (
      <>
        <Box>
          <Typography sx={{ display: "block", color: "text.secondary" }}>
            Last Updated
          </Typography>
          <RelativeTime date={service.updatedAt} />
        </Box>
      </>
    );
  };

  if (error) {
    return (
      <Box sx={{ width: "100%", py: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={fetchServices}>Retry</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <PermissionWrapper
          requiredPermission="api:service"
          permissionAction="write"
        >
          <Button
            onClick={() =>
              navigate(`${linkPrefix}services/create?project_id=${projectId}`)
            }
            startIcon={<AddIcon />}
          >
            Create Service
          </Button>
        </PermissionWrapper>
      </Box>

      {loading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            py: 6,
          }}
        >
          <CircularProgress />
        </Box>
      ) : services.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography variant="h6" component="p">
            This project has no services yet
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
              entity_name="service"
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
  );
};
