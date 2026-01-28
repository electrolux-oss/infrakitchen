import React, { useEffect, useState } from "react";

import { useConfig, CommonDialog } from "../../../../common";
import { PodDetails } from "./PodDetails";

interface PodDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  entityId: string;
  namespace: string;
  kubernetesResourceType: string;
  deploymentName: string;
  clusterName: string;
}

export const PodDetailsDialog = (props: PodDetailsDialogProps) => {
  const {
    open,
    onClose,
    entityId,
    namespace,
    kubernetesResourceType,
    deploymentName,
    clusterName
  } = props;
  const { ikApi } = useConfig();

  const [pods, setPods] = useState<any[]>([]);
  const [loadingPods, setLoadingPods] = useState(false);
  const [errorPods, setErrorPods] = useState<Error | null>(null);

  useEffect(() => {
    if (open && deploymentName) {
      setLoadingPods(true);
      setErrorPods(null);
      ikApi
        .get(
          `provider/kubernetes/${kubernetesResourceType}/${entityId}/namespaces/${namespace}/deployments/${deploymentName}/pods`,
          { raw: true },
        )
        .then((response) => {
          setPods(response);
          setLoadingPods(false);
        })
        .catch((error) => {
          setErrorPods(error);
          setLoadingPods(false);
        });
    } else if (!open) {
      setPods([]);
    }
  }, [
    open,
    ikApi,
    entityId,
    namespace,
    kubernetesResourceType,
    deploymentName,
  ]);

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title={`Pods for Deployment: ${deploymentName}`}
      maxWidth="lg"
      actions={null}
      content={
        <PodDetails
          pods={pods}
          deploymentName={deploymentName}
          namespace={namespace}
          entityId={entityId}
          kubernetesResourceType={kubernetesResourceType}
          loadingPods={loadingPods}
          clusterName={clusterName}
          errorPods={errorPods}
        />
      }
    />
  );
};
