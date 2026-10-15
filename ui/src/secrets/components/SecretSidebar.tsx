import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
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
        <EditableTagsField
          name="Secret Tags"
          editorLabel="Labels"
          value={secret.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <div className="col-span-full">
          <StatusChip status={secret.status} state={secret.state} />
        </div>
      </SidebarSection>

      <SidebarDetailsSection entity={secret} />
    </EntitySidebar>
  );
};
