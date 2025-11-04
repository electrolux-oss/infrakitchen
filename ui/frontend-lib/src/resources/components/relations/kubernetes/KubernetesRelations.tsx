import { useEffect, useMemo, useState } from "react";

import { Alert, Box, List, ListItem, Typography } from "@mui/material";

import { useConfig, GradientCircularProgress } from "../../../../common";
import { ResourceResponse } from "../../../types";

import { DeploymentsDetails } from "./K8sDeployment";

export const KubernetesRelations = (props: { entity: ResourceResponse }) => {
  const { entity } = props;

  const { ikApi } = useConfig();
  const kubernetesResourceTypes = useMemo(
    () =>
      entity.template?.cloud_resource_types.filter((type: string) =>
        type.endsWith("eks"),
      ) || [],
    [entity.template?.cloud_resource_types],
  );

  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!kubernetesResourceTypes) {
      setLoading(false);
      return;
    }
    ikApi
      .get(
        `provider/kubernetes/${kubernetesResourceTypes[0]}/${entity.id}/namespaces`,
      )
      .then((response) => {
        setNamespaces(response);
        setLoading(false);
      })
      .catch((error) => {
        setError(error);
        setLoading(false);
      });
  }, [ikApi, entity.id, kubernetesResourceTypes]);

  if (loading) {
    return <GradientCircularProgress />;
  }

  if (error) {
    return (
      <Alert severity="error">
        <Typography variant="h5" component="p">
          Error fetching k8s data
        </Typography>
        <Typography variant="body1">{error.message}</Typography>
      </Alert>
    );
  }
  return (
    <Box sx={{ width: "100%", height: "100%", overflow: "auto" }}>
      {!loading && !error && (
        <Box style={{ height: "auto", width: "100%" }}>
          {namespaces.length > 0 ? (
            <List>
              {namespaces.map((namespace) => (
                <ListItem
                  key={namespace}
                  disablePadding
                  sx={{
                    width: "100%",
                    display: "block",
                    mb: 1,
                  }}
                >
                  <DeploymentsDetails
                    entityId={entity.id}
                    namespace={namespace}
                    kubernetesResourceType={kubernetesResourceTypes[0]}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2">
              No Kubernetes namespaces found.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
