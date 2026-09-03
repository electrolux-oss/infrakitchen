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
import { GqlSecret } from "../graphql";
import {
  SecretUpdateFieldInput,
  UPDATE_SECRET_MUTATION,
} from "../graphql/mutations";

export interface SecretAboutProps {
  secret: GqlSecret;
}

export const SecretOverview = ({ secret }: SecretAboutProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:secret", "write");

  const saveField = useCallback(
    async (input: SecretUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_SECRET_MUTATION, {
          id: secret.id,
          input,
        });
        notify("Secret updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, secret.id, refreshEntity],
  );

  return (
    <OverviewCard name={secret.name}>
      <CommonField
        name={"State"}
        value={<StatusChip status={secret.status} state={secret.state} />}
      />
      <CommonField
        name={"Created"}
        value={<RelativeTime date={secret.createdAt} user={secret.creator} />}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={secret.updatedAt} />}
      />{" "}
      <EditableDescriptionField
        value={secret.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
      />{" "}
      <EditableTagsField
        name="Secret Tags"
        editorLabel="Labels"
        value={secret.labels || []}
        canEdit={canEdit}
        onSave={(value) => saveField({ labels: value })}
      />
    </OverviewCard>
  );
};
