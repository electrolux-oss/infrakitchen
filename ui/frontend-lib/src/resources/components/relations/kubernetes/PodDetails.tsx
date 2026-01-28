import React, { useState } from "react";

import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import {
  Button,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  TableContainer,
  Stack,
} from "@mui/material";

import { CommonDialog, useConfig } from "../../../../common";
import { notify, notifyError } from "../../../../common/hooks/useNotification";
import { RestartAlt } from "@mui/icons-material";
import { getDateValue } from "../../../../common/components/CommonField";
import WarningIcon from "@mui/icons-material/Warning";

interface PodDetailsProps {
  loadingPods: boolean;
  errorPods: Error | null;
  pods: any[];
  deploymentName: string;
  namespace: string;
  entityId: string;
  kubernetesResourceType: string;
  clusterName: string;
}

const PodRow = (props: {
  pod: any;
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
      .deleteRaw(
        `provider/kubernetes/${kubernetesResourceType}/${entityId}/namespaces/${namespace}/pods/${pod_name}`,
        {},
      )
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
      <TableRow
        sx={{
          "& > *": { borderBottom: "unset" },
          "&:hover": { backgroundColor: "action.hover" },
        }}
      >
        <TableCell>
          <IconButton
            aria-label="Expand Row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          <Typography variant="body1" fontWeight="medium">
            {pod?.metadata.name}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip
            label={pod?.status.phase || "Unknown"}
            color={statusColor(pod?.status.phase)}
            size="small"
            sx={{ fontWeight: "bold" }}
          />
        </TableCell>
        <TableCell align="center">
          <Typography variant="body2" color="text.secondary">
            {pod?.metadata.labels["app.kubernetes.io/version"] || "N/A"}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Typography variant="body2" color="text.secondary">
            {getDateValue(pod?.metadata.creation_timestamp) || "N/A"}
          </Typography>
        </TableCell>
        <TableCell align="center">
          {isLoading && (
            <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
              <CircularProgress />
            </Box>
          )}

          {isConfirmingKill ? (
            // Display Approve and Cancel buttons when confirming
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                color="success"
                size="small"
                startIcon={<CheckIcon />}
                onClick={() => handleKillPod(pod.metadata.name)}
                sx={{ textTransform: "none", fontWeight: "bold" }}
                disabled={isLoading}
              >
                Approve
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<CloseIcon />}
                onClick={handleCancelKill}
                sx={{ textTransform: "none", fontWeight: "bold" }}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </Stack>
          ) : (
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={handleInitiateKillConfirmation}
              disabled={isLoading}
              sx={{
                textTransform: "none",
                fontWeight: "bold",
                minWidth: "100px",
              }}
            >
              Terminate
            </Button>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box
              sx={{
                margin: 1.5,
                p: 2,
                bgcolor: "background.paper",
                borderRadius: 2,
                boxShadow: 3,
              }}
            >
              <Typography
                variant="h5"
                gutterBottom
                component="div"
                sx={{ mb: 2, color: "primary.main" }}
              >
                Pod Details
              </Typography>
              <Table size="small" aria-label="pod-labels">
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="h6" gutterBottom fontWeight="bold">
                        Labels:
                      </Typography>
                    </TableCell>
                  </TableRow>
                  {pod?.metadata.labels &&
                  Object.entries(pod.metadata.labels).length > 0 ? (
                    Object.entries(pod.metadata.labels).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell component="th" scope="row">
                          <Typography variant="body2" color="text.secondary">
                            {key}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {value as string}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 1 }}
                        >
                          No labels found for this pod.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {pod.metadata.annotations &&
                    Object.entries(pod.metadata.annotations).length > 0 && (
                      <>
                        <TableRow>
                          <TableCell colSpan={2}>
                            <Typography
                              variant="h6"
                              gutterBottom
                              fontWeight="bold"
                              sx={{ mt: 2 }}
                            >
                              Annotations:
                            </Typography>
                          </TableCell>
                        </TableRow>
                        {Object.entries(pod.metadata.annotations).map(
                          ([key, value]) => (
                            <TableRow key={key}>
                              <TableCell component="th" scope="row">
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {key}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2">
                                  {value as string}
                                </Typography>
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
                          <Typography
                            variant="h6"
                            gutterBottom
                            fontWeight="bold"
                            sx={{ mt: 2 }}
                          >
                            Containers:
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {pod.spec.containers.map((container: any) => (
                        <TableRow key={container.name}>
                          <TableCell component="th" scope="row">
                            <Typography variant="body2" color="text.secondary">
                              {container.name}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {container.image}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </Box>
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
    setIsLoading(true)
    ikApi
      .restartDeployment(
        `provider/kubernetes/${kubernetesResourceType}/${entityId}/namespaces/${namespace}/deployments/${deploymentName}`,
      )
      .then(() => {
        notify("Deployment restarted successfully", "success");
        setIsLoading(false)
        setOpenRestartConfirmationDialog(false);
      })
      .catch((error) => {
        notifyError(error);
        setIsLoading(false)
        setOpenRestartConfirmationDialog(false);
      });
  }

  return (
    <CommonDialog
      maxWidth="xs"
      title={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningIcon color="warning" />
          <Typography variant="h6" component="span">
            Confirmation
          </Typography>
        </Box>
      }
      open={openRestartConfirmationDialog}
      onClose={() => setOpenRestartConfirmationDialog(false)}
      content={
      <>
        <Typography>
          Are you sure you want to restart all pods for the {deploymentName} in
          the {clusterName} cluster?
        </Typography>
        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress />
          </Box>
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
    <Box>
      {loadingPods && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress />
        </Box>
      )}
      {errorPods && (
        <Alert severity="error">
          <Typography variant="body2">
            Error fetching pods for {deploymentName}: {errorPods.message}
          </Typography>
        </Alert>
      )}
      {!loadingPods && !errorPods && (
        <>
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Button
              variant="contained"
              startIcon={<RestartAlt />}
              onClick={() => setOpenRestartConfirmationDialog(true)}
              sx={{
                textTransform: "none",
                fontWeight: "bold",
                minWidth: "100px",
              }}
            >
              Restart All
            </Button>
          </Box>
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
                    <TableCell sx={{ width: "40px" }} />
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
            <Typography variant="body2" color="text.secondary">
              No pods found for this deployment.
            </Typography>
          )}
        </>
      )}
    </Box>
  );
};
