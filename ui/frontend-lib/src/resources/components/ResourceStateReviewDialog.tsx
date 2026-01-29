import React, { useState, useEffect } from "react";

import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

import { Typography, Paper, Box } from "@mui/material";

import { useConfig, useEntityProvider } from "../../common";
import { ActionButton } from "../../common/components/buttons/ActionButton";
import { CommonDialog } from "../../common/components/CommonDialog";
import { IkEntity, IkResourceTempState } from "../../types";
import { ENTITY_ACTION, ENTITY_STATUS } from "../../utils/constants";

interface JsonDiffViewerProps {
  originalText: string;
  modifiedText: string;
}

function JsonDiffViewer({ originalText, modifiedText }: JsonDiffViewerProps) {
  return (
    <ReactDiffViewer
      oldValue={originalText}
      newValue={modifiedText}
      splitView={true}
      leftTitle="Current State"
      rightTitle="Updated State"
      compareMethod={DiffMethod.LINES}
      showDiffOnly={false}
      hideLineNumbers={false}
      disableWordDiff={true}
      useDarkTheme={false}
    />
  );
}

export interface ResourceStateReviewDialogProps {
  open: boolean;
  onClose: () => void;
  actions?: string[];
  entity?: IkEntity;
  entity_id: string;
  title?: string;
  entity_name?: string;
}

export const ResourceStateReviewDialog: React.FC<
  ResourceStateReviewDialogProps
> = ({
  open,
  onClose,
  entity,
  entity_id,
  actions,
  title = "State Difference",
}) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const [resourceTempState, setResourceTempState] = useState<
    IkResourceTempState | undefined
  >();
  const [error, setError] = useState<any>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !entity_id) return;

    if (entity?.status === ENTITY_STATUS.APPROVAL_PENDING) {
      // If the entity is already pending approval, no need to fetch temp state
      return;
    }
    const fetchResourceTempState = async () => {
      setIsLoading(true);
      try {
        const response = await ikApi.get(
          `resource_temp_states/resource/${entity_id}`,
        );
        setResourceTempState(response);
        setError(undefined);
      } catch (e: any) {
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResourceTempState();
  }, [open, entity_id, ikApi, entity]);

  return (
    <CommonDialog
      title={title}
      maxWidth="xl"
      open={open}
      onClose={onClose}
      content={
        <>
          {isLoading && <Typography>Loading resource state...</Typography>}
          {error && (
            <Typography color="error">
              Error loading resource state: {error.message || error.toString()}
            </Typography>
          )}
          {resourceTempState && (
            <Box sx={{ width: "100%", minWidth: "1200px" }}>
              <Typography variant="h5" sx={{ mb: 2 }}>
                Resource State Comparison
              </Typography>
              <Paper variant="outlined" sx={{ p: 0, overflow: "hidden" }}>
                <JsonDiffViewer
                  originalText={(() => {
                    const filteredEntity: any = {};
                    if (entity && resourceTempState.value) {
                      Object.keys(resourceTempState.value || {}).forEach(
                        (key) => {
                          if (
                            Object.prototype.hasOwnProperty.call(entity, key)
                          ) {
                            filteredEntity[key] = (entity as any)[key];
                          }
                        },
                      );
                    }
                    return JSON.stringify(filteredEntity, null, 2);
                  })()}
                  modifiedText={JSON.stringify(
                    resourceTempState.value,
                    null,
                    2,
                  )}
                />
              </Paper>
            </Box>
          )}
          {entity?.status === ENTITY_STATUS.APPROVAL_PENDING && (
            <Typography color="warning.main">
              Resource is pending for approval.
            </Typography>
          )}
        </>
      }
      actions={
        <>
          {actions?.includes(ENTITY_ACTION.APPROVE) && (
            <>
              <ActionButton
                action={ENTITY_ACTION.APPROVE}
                onSubmit={() => {
                  onClose();
                  refreshEntity?.();
                }}
                color="success"
                variant="contained"
                disabled={error}
              >
                Approve
              </ActionButton>
              <ActionButton
                action={ENTITY_ACTION.REJECT}
                onSubmit={() => {
                  onClose();
                  refreshEntity?.();
                }}
                color="error"
                variant="contained"
                disabled={error}
              >
                Reject
              </ActionButton>
            </>
          )}
        </>
      }
    />
  );
};

export default ResourceStateReviewDialog;
