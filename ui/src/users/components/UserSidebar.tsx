import { useCallback } from "react";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { BooleanInlineField } from "../../common/components/editors/BooleanInlineField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import {
  CommonField,
  getProviderValue,
} from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { SlackSync } from "../../common/providers/slack/SlackSync";
import { TextField } from "../../ui";
import { GqlUser } from "../graphql";
import {
  UserUpdateFieldInput,
  UPDATE_USER_MUTATION,
} from "../graphql/mutations";

export interface UserSidebarProps {
  user: GqlUser;
}

export const UserSidebar = ({ user }: UserSidebarProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:user", "write");

  const isServiceAccount = user.provider === "ik_service_account";

  const saveField = useCallback(
    async (body: UserUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_USER_MUTATION, {
          id: user.id,
          body,
        });
        notify("User updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, user.id, refreshEntity],
  );

  return (
    <EntitySidebar ariaLabel="User details">
      <SidebarSection title="About">
        <CommonField name="Display Name" value={user.displayName} span="full" />
        <CommonField name="Email" value={user.email} span="full" />
        <CommonField name="First Name" value={user.firstName} span="half" />
        <CommonField name="Last Name" value={user.lastName} span="half" />
        <EditableDescriptionField
          value={user.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
      </SidebarSection>

      <SidebarSection title="Account">
        <CommonField
          name="Provider"
          value={getProviderValue(user.provider, 18)}
          span="half"
        />
        <CommonField
          name="Is Primary"
          value={user.isPrimary ? "Yes" : "No"}
          span="half"
        />
        <BooleanInlineField
          name="Deactivated"
          canEdit={canEdit}
          value={user.deactivated}
          ariaLabel="Edit deactivated"
          onSave={(value) => saveField({ deactivated: value })}
          span="half"
        />
        {isServiceAccount && (
          <CommonEditableField<string>
            name="Password"
            canEdit={canEdit}
            value={""}
            ariaLabel="Edit password"
            placeholder="••••••••"
            display={null}
            onSave={(value) => saveField({ password: value })}
            renderEditor={({ value, onChange }) => (
              <TextField
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label="Password"
                type="password"
                fullWidth
                margin="normal"
                autoFocus
                helperText="Password for the user"
              />
            )}
            span="half"
          />
        )}
        <CommonField
          name="Slack"
          value={<SlackSync userId={user.id} slackId={user.meta?.slackId} />}
          span="full"
        />
      </SidebarSection>

      <SidebarSection>
        <CommonField
          name="Created"
          value={<RelativeTime date={user.createdAt} />}
          span="half"
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={user.updatedAt} />}
          span="half"
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
