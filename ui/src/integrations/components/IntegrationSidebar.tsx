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
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import StatusChip from "../../common/StatusChip";
import { Chip } from "../../ui";
import { GqlIntegration } from "../graphql";
import {
  IntegrationUpdateFieldInput,
  UPDATE_INTEGRATION_MUTATION,
} from "../graphql/mutations";
import { integrationTypeChipColor } from "../types";

export interface IntegrationSidebarProps {
  integration: GqlIntegration;
}

/**
 * GitHub-style right sidebar for the integration detail page: groups the
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
        <EditableTagsField
          value={integration.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <div className="col-span-full">
          <div className="flex items-center gap-2">
            <StatusChip status={integration.status} />
            <Chip
              label={integration.integrationType.toUpperCase()}
              appearance="solid"
              color={integrationTypeChipColor(integration.integrationType)}
            />
          </div>
        </div>
        <CommonField
          name="Provider"
          value={getProviderValue(integration.integrationProvider)}
          span="full"
        />
      </SidebarSection>

      <SidebarDetailsSection entity={integration} />
    </EntitySidebar>
  );
};
