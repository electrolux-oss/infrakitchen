import React, { useEffect, useState } from "react";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  ButtonBase,
} from "@mui/material";

import { useConfig, GradientCircularProgress } from "../../../../common";
import { notifyError } from "../../../../common/hooks/useNotification";

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
    event: React.SyntheticEvent,
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
        .get(
          `provider/kubernetes/${kubernetesResourceType}/${entityId}/deployments/${namespace}`,
        )
        .then((response) => {
          setDeployments(response);
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
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body1" sx={{ fontWeight: "bold" }}>
            Namespace: {namespace}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {loadingDeployments && <GradientCircularProgress />}
          {errorDeployments && (
            <Alert severity="error">
              <Typography variant="body2">
                Error fetching deployments for {namespace}:{" "}
                {errorDeployments.message}
              </Typography>
            </Alert>
          )}
          {!loadingDeployments && !errorDeployments && (
            <>
              {deployments.length > 0 ? (
                <List dense>
                  <Typography variant="body2" gutterBottom>
                    Deployments:
                  </Typography>
                  {deployments.map((deployment) => (
                    <ListItem key={deployment} disablePadding sx={{ pl: 2 }}>
                      {/* Make the ListItem clickable */}
                      <ButtonBase
                        onClick={() => handleDeploymentClick(deployment)}
                        sx={{
                          width: "100%",
                          textAlign: "left",
                          p: 0.5,
                          borderRadius: "4px",
                          "&:hover": { backgroundColor: "action.hover" },
                        }}
                      >
                        <ListItemText primary={deployment} />
                      </ButtonBase>
                    </ListItem>
                  ))}
                </List>
              ) : (
                expanded && (
                  <Typography variant="body2">
                    No deployments found in this namespace.
                  </Typography>
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
