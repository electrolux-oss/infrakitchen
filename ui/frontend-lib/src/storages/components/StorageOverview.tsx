import { useCallback } from "react";

import { CommonField } from "../../common/components/CommonField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { GqlStorage } from "../graphql";
import {
  StorageUpdateFieldInput,
  UPDATE_STORAGE_MUTATION,
} from "../graphql/mutations";

export interface StorageAboutProps {
  storage: GqlStorage;
}

export const StorageOverview = ({ storage }: StorageAboutProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:storage", "write");

  const saveField = useCallback(
    async (input: StorageUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_STORAGE_MUTATION, {
          id: storage.id,
          input,
        });
        notify("Storage updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, storage.id, refreshEntity],
  );

  return (
    <OverviewCard name={storage.name}>
      <CommonField
        name={"State"}
        value={<StatusChip status={storage.status} state={storage.state} />}
      />{" "}
      <EditableDescriptionField
        value={storage.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
      />
      <CommonField
        name={"Created"}
        value={<RelativeTime date={storage.createdAt} user={storage.creator} />}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={storage.updatedAt} />}
      />{" "}
      <EditableTagsField
        name="Storage Tags"
        value={storage.labels || []}
        canEdit={canEdit}
        onSave={(value) => saveField({ labels: value })}
        helperText="Press Enter to add a tag"
      />
    </OverviewCard>
  );
};
