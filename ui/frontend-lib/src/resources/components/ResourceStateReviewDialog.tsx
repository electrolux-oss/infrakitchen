import React from "react";

import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

import { Typography, Paper, Box, CircularProgress } from "@mui/material";

import { useEntityProvider } from "../../common";
import { ActionButton } from "../../common/components/buttons/ActionButton";
import { CommonDialog } from "../../common/components/CommonDialog";
import { IkEntity } from "../../types";
import { ENTITY_ACTION, ENTITY_STATUS } from "../../utils/constants";
import { GqlResourceTempState } from "../graphql";

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
  resourceTempState?: GqlResourceTempState | null;
  loading?: boolean;
  error?: unknown;
}

export const ResourceStateReviewDialog: React.FC<
  ResourceStateReviewDialogProps
> = ({
  open,
  onClose,
  entity,
  actions,
  title = "State Difference",
  resourceTempState = null,
  loading = false,
  error,
}) => {
  const { refreshEntity } = useEntityProvider();

  return (
    <CommonDialog
      title={title}
      maxWidth={entity?.status === ENTITY_STATUS.APPROVAL_PENDING ? "sm" : "xl"}
      open={open}
      onClose={onClose}
      content={
        <>
          {error && (
            <Typography color="error">
              Error loading resource state:{" "}
              {String((error as Error)?.message || error)}
            </Typography>
          )}
          {loading && !resourceTempState && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
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
                            if (
                              key.endsWith("_ids") &&
                              Array.isArray((entity as any)[key])
                            ) {
                              // For fields that are arrays of IDs, we want to compare the IDs directly rather than the full objects
                              filteredEntity[key] = (entity as any)[key].map(
                                (item: any) =>
                                  item && typeof item === "object"
                                    ? item.id
                                    : item,
                              );
                            } else {
                              filteredEntity[key] = (entity as any)[key];
                            }
                          } else if (key === "storage_id") {
                            // entity exposes "storage" as an expanded object; map it back to a UUID for comparison
                            const storage = (entity as any)["storage"];
                            filteredEntity[key] =
                              storage && typeof storage === "object"
                                ? storage.id
                                : (storage ?? null);
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
