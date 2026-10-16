import { useCallback } from "react";

import { Grid } from "@mui/material";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { Entity } from "../../common/components/entities/Entity";
import { CommonField } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
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

export interface SecretSidebarProps {
  secret: GqlSecret;
}

/**
 * GitHub-style right sidebar for the secret detail page: groups the
 * secret's description, status and history so the main column can focus on
 * its configuration and the entities that use it.
 */
export const SecretSidebar = ({ secret }: SecretSidebarProps) => {
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
    <EntitySidebar ariaLabel="Secret details">
      <SidebarSection title="About">
        <EditableDescriptionField
          value={secret.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <EditableTagsField
          name="Secret Tags"
          editorLabel="Labels"
          value={secret.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <Grid size={12}>
          <StatusChip status={secret.status} state={secret.state} />
        </Grid>
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            secret.creator ? (
              <Entity entity={{ ...secret.creator, entityType: "user" }} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={secret.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={secret.updatedAt} />}
          size={6}
        />
        <CommonField name="Revision" value={secret.revisionNumber} size={12} />
      </SidebarSection>
    </EntitySidebar>
  );
};
