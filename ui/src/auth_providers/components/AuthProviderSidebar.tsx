import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { BooleanInlineField } from "../../common/components/editors/BooleanInlineField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableNameField } from "../../common/components/editors/EditableNameField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import {
  CommonField,
  getProviderValue,
} from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { Labels } from "../../common/components/labels/Labels";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { GqlAuthProvider } from "../graphql";
import {
  AuthProviderUpdateFieldInput,
  UPDATE_AUTH_PROVIDER_MUTATION,
} from "../graphql/mutations";

export interface AuthProviderSidebarProps {
  authProvider: GqlAuthProvider;
}

export const AuthProviderSidebar = ({
  authProvider,
}: AuthProviderSidebarProps) => {
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:auth_provider", "write");

  const saveField = useEntityFieldSaver<AuthProviderUpdateFieldInput>(
    UPDATE_AUTH_PROVIDER_MUTATION,
    authProvider.id,
    "Auth Provider",
  );

  return (
    <EntitySidebar ariaLabel="Auth provider details">
      <SidebarSection title="About">
        <EditableNameField
          value={authProvider.name}
          canEdit={canEdit}
          onSave={(value) => saveField({ name: value })}
        />
        <EditableDescriptionField
          value={authProvider.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
      </SidebarSection>

      <SidebarSection title="Configuration">
        <CommonField
          name="Auth Provider Type"
          value={getProviderValue(authProvider.authProvider, 18)}
          span="half"
        />
        <BooleanInlineField
          name="Enabled"
          canEdit={canEdit}
          value={authProvider.enabled}
          ariaLabel="Edit enabled status"
          onSave={(value) => saveField({ enabled: value })}
          span="half"
        />
        <EditableTagsField
          name="Filter By Domain"
          value={authProvider.filterByDomain || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ filterByDomain: value })}
          helperText="Add domains and press Enter"
          display={
            authProvider.filterByDomain &&
            authProvider.filterByDomain.length > 0 ? (
              <Labels labels={authProvider.filterByDomain} />
            ) : (
              <PlaceholderText />
            )
          }
        />
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created"
          value={<RelativeTime date={authProvider.createdAt} />}
          span="half"
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={authProvider.updatedAt} />}
          span="half"
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
