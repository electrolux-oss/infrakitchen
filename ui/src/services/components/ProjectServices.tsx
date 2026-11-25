import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router";

import { PermissionWrapper } from "../../common";
import { EntityCard } from "../../common/components/cards/EntityCard";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import { HeroPlusCircleIcon } from "../../icons";
import { Alert, Spinner, Button } from "../../ui";
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
        <div>
          <p className="m-0 block text-body2 text-fg-muted">Last Updated</p>
          <RelativeTime date={service.updatedAt} />
        </div>
      </>
    );
  };

  if (error) {
    return (
      <div className="w-full py-4">
        <Alert className="mb-4" severity="error">
          {error}
        </Alert>
        <Button onClick={fetchServices}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-end">
        <PermissionWrapper
          requiredPermission="api:service"
          permissionAction="write"
        >
          <Button
            onClick={() =>
              navigate(`${linkPrefix}services/create?project_id=${projectId}`)
            }
            startIcon={<HeroPlusCircleIcon />}
          >
            Create Service
          </Button>
        </PermissionWrapper>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : services.length === 0 ? (
        <div className="py-8 text-center">
          <p className="m-0 text-h6">This project has no services yet</p>
        </div>
      ) : (
        <div className="mt-6 grid w-full grid-cols-[repeat(auto-fill,_minmax(var(--card-min-width),_1fr))] gap-4 [--card-min-width:240px] sm:[--card-min-width:260px] md:[--card-min-width:300px]">
          {services.map((service) => (
            <EntityCard
              key={service.id}
              entity_name="service"
              name={service.name}
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
  );
};
