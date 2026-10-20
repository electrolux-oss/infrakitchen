import React, { useEffect, useState } from "react";

import { useConfig, GradientCircularProgress } from "../../../../common";
import { notifyError } from "../../../../common/hooks/useNotification";
import { HeroChevronDownIcon } from "../../../../icons";
import { KUBERNETES_DEPLOYMENTS_QUERY } from "../../../../providers/kubernetes/graphql";
import {
  Alert,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
} from "../../../../ui";

import { PodDetailsDialog } from "./PodDetailsDialog";

interface DeploymentsDetailsProps {
  entityId: string;
  namespace: string;
  kubernetesResourceType: string;
  clusterName: string;
}

export const DeploymentsDetails = (props: DeploymentsDetailsProps) => {
  const { entityId, namespace, kubernetesResourceType, clusterName } = props;
  const { ikApi } = useConfig();

  const [deployments, setDeployments] = useState<string[]>([]);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [errorDeployments, setErrorDeployments] = useState<Error | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [openPodDialog, setOpenPodDialog] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<string>("");

  const handleToggleExpand = (
    _event: React.SyntheticEvent,
    isExpanded: boolean,
  ) => {
    setExpanded(isExpanded);
  };

  const handleDeploymentClick = (deploymentName: string) => {
    setSelectedDeployment(deploymentName);
    setOpenPodDialog(true);
  };

  const handleClosePodDialog = () => {
    setOpenPodDialog(false);
    setSelectedDeployment(""); // Clear selected deployment on close
  };

  useEffect(() => {
    if (expanded && deployments.length === 0) {
      setLoadingDeployments(true);
      setErrorDeployments(null);
      ikApi
        .graphqlRequest<{ kubernetesDeployments: string[] }>(
          KUBERNETES_DEPLOYMENTS_QUERY,
          {
            k8sService: kubernetesResourceType,
            resourceId: entityId,
            namespace,
          },
        )
        .then((response) => {
          setDeployments(response.kubernetesDeployments);
          setLoadingDeployments(false);
        })
        .catch((error) => {
          setErrorDeployments(error);
          setLoadingDeployments(false);
          notifyError(error);
        });
    }
  }, [
    expanded,
    ikApi,
    entityId,
    namespace,
    kubernetesResourceType,
    deployments.length,
  ]);

  return (
    <>
      <Accordion expanded={expanded} onChange={handleToggleExpand}>
        <AccordionSummary expandIcon={<HeroChevronDownIcon />}>
          <p className="m-0 text-body1 font-bold">Namespace: {namespace}</p>
        </AccordionSummary>
        <AccordionDetails>
          {loadingDeployments && <GradientCircularProgress />}
          {errorDeployments && (
            <Alert severity="error">
              <p className="m-0 text-body2">
                Error fetching deployments for {namespace}:{" "}
                {errorDeployments.message}
              </p>
            </Alert>
          )}
          {!loadingDeployments && !errorDeployments && (
            <>
              {deployments.length > 0 ? (
                <List dense>
                  <p className="m-0 mb-[0.35em] text-body2">Deployments:</p>
                  {deployments.map((deployment) => (
                    <ListItem className="pl-4" key={deployment} disablePadding>
                      {/* Make the ListItem clickable */}
                      <button
                        type="button"
                        className="inline-flex w-full cursor-pointer items-center justify-center justify-start rounded-surface border-0 bg-transparent p-0 p-1 text-left text-inherit outline-none hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/35"
                        onClick={() => handleDeploymentClick(deployment)}
                      >
                        <ListItemText primary={deployment} />
                      </button>
                    </ListItem>
                  ))}
                </List>
              ) : (
                expanded && (
                  <p className="m-0 text-body2">
                    No deployments found in this namespace.
                  </p>
                )
              )}
            </>
          )}
        </AccordionDetails>
      </Accordion>
      <PodDetailsDialog
        open={openPodDialog}
        onClose={handleClosePodDialog}
        entityId={entityId}
        namespace={namespace}
        kubernetesResourceType={kubernetesResourceType}
        deploymentName={selectedDeployment}
        clusterName={clusterName}
      />
    </>
  );
};
