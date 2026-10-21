import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableNameField } from "../../common/components/editors/EditableNameField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import {
  CommonField,
  getProviderValue,
} from "../../common/components/fields/CommonField";
import { StatusLabel } from "../../common/components/labels";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { GqlIntegration } from "../graphql";
import {
  IntegrationUpdateFieldInput,
  UPDATE_INTEGRATION_MUTATION,
} from "../graphql/mutations";

export interface IntegrationSidebarProps {
  integration: GqlIntegration;
}

/**
 * Right context sidebar for the integration detail page: groups the
 * integration's description, status and history so the main column can focus
 * on its configuration and the entities that use it.
 */
export const IntegrationSidebar = ({
  integration,
}: IntegrationSidebarProps) => {
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:integration", "write");

  const saveField = useEntityFieldSaver<IntegrationUpdateFieldInput>(
    UPDATE_INTEGRATION_MUTATION,
    integration.id,
    "Integration",
  );

  return (
    <EntitySidebar ariaLabel="Integration details">
      <SidebarSection title="About">
        <EditableNameField
          value={integration.name}
          canEdit={canEdit}
          onSave={(value) => saveField({ name: value })}
        />
        <EditableDescriptionField
          value={integration.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <CommonField
          name="Status"
          value={<StatusLabel status={integration.status} />}
          span="full"
        />
        <EditableTagsField
          value={integration.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
        <CommonField
          name="Provider"
          value={getProviderValue(integration.integrationProvider, 18)}
          span="full"
        />
      </SidebarSection>

      <SidebarDetailsSection entity={integration} />
    </EntitySidebar>
  );
};
