import { useCallback } from "react";

import { Checkbox, FormControlLabel, TextField } from "@mui/material";

import {
  CommonField,
  getProviderValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { UserAvatar } from "../../common/components/UserAvatar";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { SlackSync } from "../../common/providers/slack/SlackSync";
import {
  UserUpdateFieldInput,
  UPDATE_USER_MUTATION,
} from "../graphql/mutations";
import { UserResponse } from "../types";

export interface UserAboutProps {
  user: UserResponse;
}

export const UserOverview = ({ user }: UserAboutProps) => {
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
    <OverviewCard
      name={user.identifier}
      description={user.description}
      icon={<UserAvatar identifier={user.identifier} />}
      chip={user.deactivated ? "Deactivated" : undefined}
      chipColor="error"
    >
      <CommonField name={"Display Name"} value={user.displayName} />
      <CommonField name={"Email"} value={user.email} />
      <CommonField name={"First Name"} value={user.firstName} />
      <CommonField name={"Last Name"} value={user.lastName} />
      <CommonField name={"Identifier"} value={user.identifier} />
      <CommonField name={"Is Primary"} value={user.isPrimary ? "Yes" : "No"} />
      <CommonField name={"Provider"} value={getProviderValue(user.provider)} />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={user.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{user.description || "No description"}</span>}
        onSave={(value) => saveField({ description: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            label="Description"
            fullWidth
            multiline
            minRows={2}
            margin="normal"
            autoFocus
          />
        )}
        size={12}
      />
      <CommonEditableField<boolean>
        name={"Deactivated"}
        canEdit={canEdit}
        value={user.deactivated}
        ariaLabel="Edit deactivated"
        display={<span>{user.deactivated ? "Yes" : "No"}</span>}
        onSave={(value) => saveField({ deactivated: value })}
        renderEditor={({ value, onChange }) => (
          <FormControlLabel
            control={
              <Checkbox
                checked={value}
                onChange={(e) => onChange(e.target.checked)}
              />
            }
            label="Deactivated"
          />
        )}
        size={6}
      />
      {isServiceAccount && (
        <CommonEditableField<string>
          name={"Password"}
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
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              autoFocus
              helperText="Password for the user"
            />
          )}
          size={6}
        />
      )}
      <CommonField
        name={"Created"}
        value={<RelativeTime date={user.createdAt} />}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={user.updatedAt} />}
      />
      <CommonField
        name={"Slack"}
        value={<SlackSync userId={user.id} slackId={user.meta?.slackId} />}
      />
    </OverviewCard>
  );
};
