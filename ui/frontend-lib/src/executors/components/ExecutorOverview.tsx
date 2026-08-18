import { useCallback, useMemo, useState } from "react";

import ScheduleIcon from "@mui/icons-material/Schedule";
import { Button, Stack, TextField } from "@mui/material";

import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { ScheduleEntityActionDialog } from "../../common/components/ScheduleEntityActionDialog";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { sameStringSet } from "../../common/utils";
import {
  ExecutorUpdateFieldInput,
  EXECUTOR_UPDATE_MUTATION,
  GqlExecutor,
} from "../graphql";

import { SourceCodeConfigEditor } from "./SourceCodeConfigEditor";

export interface ExecutorAboutProps {
  executor: GqlExecutor;
}

export const ExecutorOverview = ({ executor }: ExecutorAboutProps) => {
  const { ikApi } = useConfig();
  const { actions, refreshEntity, scheduledActions, userEntityPermissions } =
    useEntityProvider();
  const canEdit = userEntityPermissions.includes("admin");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

  const saveField = useCallback(
    async (input: ExecutorUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(EXECUTOR_UPDATE_MUTATION, {
          id: executor.id,
          input,
        });
        notify("Executor updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, executor.id, refreshEntity],
  );

  const pendingScheduledActions = useMemo(
    () =>
      scheduledActions
        .filter((action) => action.status === "PENDING")
        .sort(
          (left, right) =>
            new Date(left.runAt).getTime() - new Date(right.runAt).getTime(),
        ),
    [scheduledActions],
  );

  const pendingScheduledAction = pendingScheduledActions[0] ?? null;
  const formatScheduledRunAt = useCallback(
    (runAt: string) => new Date(runAt).toLocaleString(),
    [],
  );

  return (
    <OverviewCard
      name={executor.name}
      description={executor.description || "No description"}
      actions={
        <Stack spacing={1} sx={{ alignItems: "flex-end" }}>
          {actions.includes("execute") && (
            <Button
              variant={pendingScheduledAction ? "contained" : "outlined"}
              color={pendingScheduledAction ? "warning" : "inherit"}
              startIcon={<ScheduleIcon />}
              onClick={() => setIsScheduleDialogOpen(true)}
            >
              {pendingScheduledAction
                ? `Scheduled Apply: ${formatScheduledRunAt(pendingScheduledAction.runAt)}`
                : "Schedule Apply"}
            </Button>
          )}
          <FavoriteButton
            componentId={String(executor.id)}
            componentType="executor"
            ariaLabel="Add executor to favorites"
            isFavorite={executor.isFavorite}
          />
        </Stack>
      }
    >
      <CommonField
        name={"State"}
        value={<StatusChip status={executor.status} state={executor.state} />}
      />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={executor.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{executor.description || "No description"}</span>}
        onSave={(value) => saveField({ description: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            label="Description"
            fullWidth
            multiline
            minRows={2}
            margin="normal"
            autoFocus
          />
        )}
      />
      <CommonField
        name={"Code Repository"}
        value={
          executor.sourceCode ? (
            <GetReferenceUrlValue {...executor.sourceCode} />
          ) : null
        }
      />
      <SourceCodeConfigEditor executor={executor} canEdit={canEdit} />

      <CommonField
        name={"Created"}
        value={
          <RelativeTime date={executor.createdAt} user={executor.creator} />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={executor.updatedAt} />}
      />
      <CommonEditableField<string[]>
        name={"Labels"}
        canEdit={canEdit}
        value={executor.labels || []}
        ariaLabel="Edit labels"
        isEqual={sameStringSet}
        display={<Labels labels={executor.labels || []} />}
        onSave={(value) => saveField({ labels: value })}
        renderEditor={({ value, onChange }) => (
          <StringTagEditor
            value={value}
            onChange={onChange}
            label="Labels"
            helperText="Press Enter to add a label"
          />
        )}
        size={12}
      />
      <ScheduleEntityActionDialog
        open={isScheduleDialogOpen}
        entityId={String(executor.id)}
        entityType="executor"
        scheduledAction={pendingScheduledAction}
        onClose={() => setIsScheduleDialogOpen(false)}
        onChanged={() => {
          refreshEntity?.();
        }}
      />
    </OverviewCard>
  );
};
