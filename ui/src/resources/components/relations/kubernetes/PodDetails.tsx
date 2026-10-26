import React, { useState } from "react";

import { CommonDialog, useConfig } from "../../../../common";
import { getDateValue } from "../../../../common/components/fields/CommonField";
import { notify, notifyError } from "../../../../common/hooks/useNotification";
import { HeroCheckIcon } from "../../../../icons";
import { HeroExclamationTriangleIcon } from "../../../../icons";
import { HeroTrashIcon } from "../../../../icons";
import {
  HeroXMarkIcon,
  HeroChevronDownIcon,
  HeroArrowPathIcon,
} from "../../../../icons";
import {
  DELETE_KUBERNETES_POD_MUTATION,
  RESTART_KUBERNETES_DEPLOYMENT_MUTATION,
} from "../../../../providers/kubernetes/graphql";
import { K8sPod } from "../../../../providers/kubernetes/types";
import {
  Alert,
  Spinner,
  Button,
  IconButton,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Collapse,
} from "../../../../ui";

interface PodDetailsProps {
  loadingPods: boolean;
  errorPods: Error | null;
  pods: K8sPod[];
  deploymentName: string;
  namespace: string;
  entityId: string;
  kubernetesResourceType: string;
  clusterName: string;
}

const PodRow = (props: {
  pod: K8sPod;
  entityId: string;
  namespace: string;
  kubernetesResourceType: string;
}) => {
  const { pod, entityId, namespace, kubernetesResourceType } = props;
  const [open, setOpen] = useState(false);
  const { ikApi } = useConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmingKill, setIsConfirmingKill] = useState(false);

  const statusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "running":
        return "success";
      case "pending":
        return "warning";
      case "failed":
      case "evicted":
        return "error";
      case "succeeded":
        return "info";
      default:
        return "default";
    }
  };

  const handleKillPod = (pod_name: string) => {
    setIsLoading(true);
    ikApi
      .graphqlRequest(DELETE_KUBERNETES_POD_MUTATION, {
        k8sService: kubernetesResourceType,
        resourceId: entityId,
        namespace,
        podName: pod_name,
      })
      .then(() => {
        notify(`Pod ${pod_name} termination initiated.`, "info");
        setIsConfirmingKill(false);
        setIsLoading(false);
      })
      .catch((error) => {
        notifyError(error);
        setIsConfirmingKill(false);
        setIsLoading(false);
      });
  };

  const handleInitiateKillConfirmation = () => {
    setIsConfirmingKill(true);
  };

  const handleCancelKill = () => {
    setIsConfirmingKill(false);
  };

  return (
    <React.Fragment>
      <TableRow className="hover:bg-hover [&>*]:border-b-0">
        <TableCell>
          <IconButton
            aria-label="Expand Row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <HeroChevronDownIcon className="rotate-180" />
            ) : (
              <HeroChevronDownIcon />
            )}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          <p className="m-0 text-body1 font-medium">{pod?.metadata.name}</p>
        </TableCell>
        <TableCell align="center">
          <Label
            label={pod?.status.phase || "Unknown"}
            tone={statusColor(pod?.status.phase)}
          />
        </TableCell>
        <TableCell align="center">
          <p className="m-0 text-body2 text-fg-muted">
            {pod?.metadata.labels["app.kubernetes.io/version"] || "N/A"}
          </p>
        </TableCell>
        <TableCell align="center">
          <p className="m-0 text-body2 text-fg-muted">
            {getDateValue(pod?.metadata.creation_timestamp) || "N/A"}
          </p>
        </TableCell>
        <TableCell align="center">
          {isLoading && (
            <div className="flex justify-center p-4">
              <Spinner />
            </div>
          )}

          {isConfirmingKill ? (
            // Display Approve and Cancel buttons when confirming
            <div className="flex flex-row justify-end gap-2">
              <Button
                className="font-bold normal-case"
                variant="contained"
                startIcon={<HeroCheckIcon />}
                onClick={() => handleKillPod(pod.metadata.name)}
                disabled={isLoading}
              >
                Approve
              </Button>
              <Button
                className="font-bold normal-case"
                color="error"
                startIcon={<HeroXMarkIcon />}
                onClick={handleCancelKill}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              className="min-w-25 font-bold normal-case"
              variant="contained"
              color="error"
              startIcon={<HeroTrashIcon />}
              onClick={handleInitiateKillConfirmation}
              disabled={isLoading}
            >
              Terminate
            </Button>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} unmountOnExit>
            <div className="m-3 rounded-surface bg-paper p-4 shadow-[var(--ik-shadow-3)]">
              <div className="m-0 mb-4 text-h5 text-primary">Pod Details</div>
              <Table size="small" aria-label="pod-labels">
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={2}>
                      <h6 className="m-0 mb-[0.35em] text-h6 font-bold">
                        Labels:
                      </h6>
                    </TableCell>
                  </TableRow>
                  {pod?.metadata.labels &&
                  Object.entries(pod.metadata.labels).length > 0 ? (
                    Object.entries(pod.metadata.labels).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell component="th" scope="row">
                          <p className="m-0 text-body2 text-fg-muted">{key}</p>
                        </TableCell>
                        <TableCell align="right">
                          <p className="m-0 text-body2">{value as string}</p>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} align="center">
                        <p className="m-0 py-2 text-body2 text-fg-muted">
                          No labels found for this pod.
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  {pod.metadata.annotations &&
                    Object.entries(pod.metadata.annotations).length > 0 && (
                      <>
                        <TableRow>
                          <TableCell colSpan={2}>
                            <h6 className="m-0 mt-4 mb-[0.35em] text-h6 font-bold">
                              Annotations:
                            </h6>
                          </TableCell>
                        </TableRow>
                        {Object.entries(pod.metadata.annotations).map(
                          ([key, value]) => (
                            <TableRow key={key}>
                              <TableCell component="th" scope="row">
                                <p className="m-0 text-body2 text-fg-muted">
                                  {key}
                                </p>
                              </TableCell>
                              <TableCell align="right">
                                <p className="m-0 text-body2">
                                  {value as string}
                                </p>
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </>
                    )}
                  {pod.spec.containers && pod.spec.containers.length > 0 && (
                    <>
                      <TableRow>
                        <TableCell colSpan={2}>
                          <h6 className="m-0 mt-4 mb-[0.35em] text-h6 font-bold">
                            Containers:
                          </h6>
                        </TableCell>
                      </TableRow>
                      {pod.spec.containers.map((container: any) => (
                        <TableRow key={container.name}>
                          <TableCell component="th" scope="row">
                            <p className="m-0 text-body2 text-fg-muted">
                              {container.name}
                            </p>
                          </TableCell>
                          <TableCell align="right">
                            <p className="m-0 text-body2">{container.image}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};

const RestartPodsDialog = (props: {
  openRestartConfirmationDialog: boolean;
  setOpenRestartConfirmationDialog: (value: boolean) => void;
  deploymentName: string;
  clusterName: string;
  kubernetesResourceType: string;
  entityId: string;
  namespace: string;
}) => {
  const {
    openRestartConfirmationDialog,
    setOpenRestartConfirmationDialog,
    deploymentName,
    clusterName,
    kubernetesResourceType,
    entityId,
    namespace,
  } = props;

  const { ikApi } = useConfig();
  const [isLoading, setIsLoading] = useState(false);

  const handleRestart = () => {
    setIsLoading(true);
    ikApi
      .graphqlRequest(RESTART_KUBERNETES_DEPLOYMENT_MUTATION, {
        k8sService: kubernetesResourceType,
        resourceId: entityId,
        namespace,
        deploymentName,
      })
      .then(() => {
        notify("Deployment restarted successfully", "success");
        setIsLoading(false);
        setOpenRestartConfirmationDialog(false);
      })
      .catch((error) => {
        notifyError(error);
        setIsLoading(false);
        setOpenRestartConfirmationDialog(false);
      });
  };

  return (
    <CommonDialog
      maxWidth="xs"
      title={
        <div className="flex items-center gap-2">
          <HeroExclamationTriangleIcon color="warning" />
          <span className="text-h6">Confirmation</span>
        </div>
      }
      open={openRestartConfirmationDialog}
      onClose={() => setOpenRestartConfirmationDialog(false)}
      content={
        <>
          <p className="m-0 text-body2">
            Are you sure you want to restart all pods for the {deploymentName}{" "}
            in the {clusterName} cluster?
          </p>
          {isLoading && (
            <div className="flex justify-center p-4">
              <Spinner />
            </div>
          )}
        </>
      }
      actions={
        <Button onClick={handleRestart} variant="contained">
          Restart
        </Button>
      }
    />
  );
};

export const PodDetails = (props: PodDetailsProps) => {
  const {
    loadingPods,
    errorPods,
    pods,
    deploymentName,
    entityId,
    namespace,
    kubernetesResourceType,
    clusterName,
  } = props;

  const [openRestartConfirmationDialog, setOpenRestartConfirmationDialog] =
    useState(false);

  return (
    <div>
      {loadingPods && (
        <div className="flex justify-center p-4">
          <Spinner />
        </div>
      )}
      {errorPods && (
        <Alert severity="error">
          <p className="m-0 text-body2">
            Error fetching pods for {deploymentName}: {errorPods.message}
          </p>
        </Alert>
      )}
      {!loadingPods && !errorPods && (
        <>
          <div className="mb-4 flex items-center justify-end">
            <Button
              className="min-w-25 font-bold normal-case"
              variant="contained"
              startIcon={<HeroArrowPathIcon />}
              onClick={() => setOpenRestartConfirmationDialog(true)}
            >
              Restart All
            </Button>
          </div>
          <RestartPodsDialog
            openRestartConfirmationDialog={openRestartConfirmationDialog}
            setOpenRestartConfirmationDialog={setOpenRestartConfirmationDialog}
            deploymentName={deploymentName}
            clusterName={clusterName}
            kubernetesResourceType={kubernetesResourceType}
            entityId={entityId}
            namespace={namespace}
          />

          {pods.length > 0 ? (
            <TableContainer>
              <Table stickyHeader aria-label="pods table">
                <TableHead>
                  <TableRow>
                    <TableCell className="w-10" />
                    <TableCell>Pod Name</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Version</TableCell>
                    <TableCell align="center">Created At</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pods.map((pod) => (
                    <PodRow
                      key={pod?.metadata.uid}
                      pod={pod}
                      entityId={entityId}
                      namespace={namespace}
                      kubernetesResourceType={kubernetesResourceType}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <p className="m-0 text-body2 text-fg-muted">
              No pods found for this deployment.
            </p>
          )}
        </>
      )}
    </div>
  );
};
