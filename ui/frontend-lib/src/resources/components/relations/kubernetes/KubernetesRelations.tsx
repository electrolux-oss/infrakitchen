import { useEffect, useMemo, useState } from "react";

import { useConfig, GradientCircularProgress } from "../../../../common";
import { KUBERNETES_NAMESPACES_QUERY } from "../../../../providers/kubernetes/graphql";
import { Alert, List, ListItem } from "../../../../ui";
import { GqlResource } from "../../../graphql";

import { DeploymentsDetails } from "./K8sDeployment";

export const KubernetesRelations = (props: { entity: GqlResource }) => {
  const { entity } = props;

  const { ikApi } = useConfig();
  const kubernetesResourceTypes = useMemo(
    () =>
      entity.template?.cloudResourceTypes?.filter((type: string) =>
        type.endsWith("eks"),
      ) || [],
    [entity.template?.cloudResourceTypes],
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
      .graphqlRequest<{ kubernetesNamespaces: string[] }>(
        KUBERNETES_NAMESPACES_QUERY,
        {
          k8sService: kubernetesResourceTypes[0],
          resourceId: entity.id,
        },
      )
      .then((response) => {
        setNamespaces(response.kubernetesNamespaces);
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
        <p className="m-0 text-h5">Error fetching k8s data</p>
        <p className="m-0 text-body1">{error.message}</p>
      </Alert>
    );
  }
  return (
    <div className="h-full w-full overflow-auto">
      {!loading && !error && (
        <div style={{ height: "auto", width: "100%" }}>
          {namespaces.length > 0 ? (
            <List>
              {namespaces.map((namespace) => (
                <ListItem
                  className="mb-2 block w-full"
                  key={namespace}
                  disablePadding
                >
                  <DeploymentsDetails
                    entityId={entity.id}
                    namespace={namespace}
                    kubernetesResourceType={kubernetesResourceTypes[0]}
                    clusterName={entity.name}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <p className="m-0 text-body2">No Kubernetes namespaces found.</p>
          )}
        </div>
      )}
    </div>
  );
};
