import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { CommonField } from "../../common/components/fields/CommonField";
import { StatusLabel } from "../../common/components/labels";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { GqlSecret } from "../graphql";
import {
  SecretUpdateFieldInput,
  UPDATE_SECRET_MUTATION,
} from "../graphql/mutations";

export interface SecretSidebarProps {
  secret: GqlSecret;
}

/**
 * Right context sidebar for the secret detail page: groups the
 * secret's description, status and history so the main column can focus on
 * its configuration and the entities that use it.
 */
export const SecretSidebar = ({ secret }: SecretSidebarProps) => {
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:secret", "write");

  const saveField = useEntityFieldSaver<SecretUpdateFieldInput>(
    UPDATE_SECRET_MUTATION,
    secret.id,
    "Secret",
  );

  return (
    <EntitySidebar ariaLabel="Secret details">
      <SidebarSection title="About">
        <EditableDescriptionField
          value={secret.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <CommonField
          name="Status"
          value={<StatusLabel status={secret.status} state={secret.state} />}
          span="full"
        />
        <EditableTagsField
          name="Secret Tags"
          editorLabel="Labels"
          value={secret.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarDetailsSection entity={secret} />
    </EntitySidebar>
  );
};
