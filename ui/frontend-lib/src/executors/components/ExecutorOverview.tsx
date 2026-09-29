import { useCallback, useState } from "react";

import { FavoriteButton } from "../../common/components/buttons/FavoriteButton";
import { OverviewCard } from "../../common/components/cards/OverviewCard";
import { ScheduleEntityActionDialog } from "../../common/components/dialogs/ScheduleEntityActionDialog";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { ScheduledApplyValue } from "../../common/components/fields/ScheduledApplyValue";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { usePendingScheduledAction } from "../../common/hooks/usePendingScheduledAction";
import StatusChip from "../../common/StatusChip";
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
  const { refreshEntity, userEntityPermissions } = useEntityProvider();
  const { pendingScheduledAction } = usePendingScheduledAction();
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
  return (
    <OverviewCard
      name={executor.name}
      actions={
        <FavoriteButton
          componentId={String(executor.id)}
          componentType="executor"
          ariaLabel="Add executor to favorites"
          isFavorite={executor.isFavorite}
        />
      }
    >
      <CommonField
        name={"State"}
        value={<StatusChip status={executor.status} state={executor.state} />}
      />
      {pendingScheduledAction && (
        <CommonField
          name={"Next Scheduled Apply"}
          value={
            <ScheduledApplyValue scheduledAction={pendingScheduledAction} />
          }
        />
      )}
      <EditableDescriptionField
        value={executor.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
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
        value={<RelativeTime date={executor.createdAt} />}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={executor.updatedAt} />}
      />{" "}
      <EditableTagsField
        value={executor.labels || []}
        canEdit={canEdit}
        onSave={(value) => saveField({ labels: value })}
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
