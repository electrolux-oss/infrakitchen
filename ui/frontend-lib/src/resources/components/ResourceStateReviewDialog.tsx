import React from "react";

import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

import { useEntityProvider } from "../../common";
import {
  DIFF_VIEWER_DARK_VARIABLES,
  DIFF_VIEWER_FONT_SIZE,
} from "../../common/components/activity/DiffEditor";
import { ActionButton } from "../../common/components/buttons/ActionButton";
import { CommonDialog } from "../../common/components/dialogs/CommonDialog";
import { IkEntity } from "../../types";
import { Spinner, useColorScheme } from "../../ui";
import { ENTITY_ACTION, ENTITY_STATUS } from "../../utils/constants";
import { GqlResourceTempState } from "../graphql";

interface JsonDiffViewerProps {
  originalText: string;
  modifiedText: string;
}

function JsonDiffViewer({ originalText, modifiedText }: JsonDiffViewerProps) {
  const { resolvedMode: mode } = useColorScheme();

  return (
    <ReactDiffViewer
      key={`resource-diff-${mode}`}
      oldValue={originalText}
      newValue={modifiedText}
      splitView={true}
      compareMethod={DiffMethod.LINES}
      showDiffOnly={false}
      hideLineNumbers={false}
      disableWordDiff={true}
      useDarkTheme={mode === "dark"}
      styles={{
        variables: { dark: DIFF_VIEWER_DARK_VARIABLES },
        contentText: { fontSize: DIFF_VIEWER_FONT_SIZE },
        lineNumber: { fontSize: DIFF_VIEWER_FONT_SIZE },
      }}
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
            <p className="m-0 text-body2 text-error">
              Error loading resource state:{" "}
              {String((error as Error)?.message || error)}
            </p>
          )}
          {loading && !resourceTempState && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {resourceTempState && (
            <div className="w-full">
              <div className="rounded-surface border border-divider bg-paper p-0 text-fg">
                <div className="grid min-w-300 grid-cols-[1fr_1fr] border-b border-divider bg-paper">
                  <h6 className="m-0 px-4 py-3 text-subtitle2 text-grey-500">
                    Current State
                  </h6>
                  <h6 className="m-0 px-4 py-3 text-subtitle2 text-grey-500">
                    Updated State
                  </h6>
                </div>
                <div className="max-h-[70vh] w-full max-w-full overflow-auto [&_.diff-viewer-wrapper]:min-w-300 [&_table]:mt-0">
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
                </div>
              </div>
            </div>
          )}
          {entity?.status === ENTITY_STATUS.APPROVAL_PENDING && (
            <p className="m-0 text-body2 text-warning">
              Resource is pending for approval.
            </p>
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
