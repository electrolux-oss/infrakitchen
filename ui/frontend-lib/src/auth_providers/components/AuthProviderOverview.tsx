import { useCallback } from "react";

import { TextField } from "@mui/material";

import {
  CommonField,
  getProviderValue,
} from "../../common/components/CommonField";
import { BooleanInlineField } from "../../common/components/editors/BooleanInlineField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { PlaceholderText } from "../../common/components/PlaceholderDescription";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";

import { GqlAuthProvider } from "../graphql";
import {
  AuthProviderUpdateFieldInput,
  UPDATE_AUTH_PROVIDER_MUTATION,
} from "../graphql/mutations";

export interface AuthProviderAboutProps {
  authProvider: GqlAuthProvider;
}

export const AuthProviderOverview = ({
  authProvider,
}: AuthProviderAboutProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:auth_provider", "write");

  const saveField = useCallback(
    async (input: AuthProviderUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_AUTH_PROVIDER_MUTATION, {
          id: authProvider.id,
          input,
        });
        notify("Auth Provider updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, authProvider.id, refreshEntity],
  );

  return (
    <OverviewCard name={authProvider.name}>
      <CommonEditableField<string>
        name={"Name"}
        canEdit={canEdit}
        value={authProvider.name}
        ariaLabel="Edit name"
        display={<span>{authProvider.name}</span>}
        onSave={(value) => saveField({ name: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            slotProps={{ input: { "aria-label": "Name" } }}
            fullWidth
            margin="normal"
            autoFocus
          />
        )}
        size={6}
      />
      <CommonField
        name={"Auth Provider Type"}
        value={getProviderValue(authProvider.authProvider)}
        size={6}
      />{" "}
      <EditableDescriptionField
        value={authProvider.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
      />
      <BooleanInlineField
        name={"Enabled"}
        canEdit={canEdit}
        value={authProvider.enabled}
        ariaLabel="Edit enabled status"
        onSave={(value) => saveField({ enabled: value })}
        size={6}
      />{" "}
      <EditableTagsField
        name="Filter By Domain"
        value={authProvider.filterByDomain || []}
        canEdit={canEdit}
        onSave={(value) => saveField({ filterByDomain: value })}
        helperText="Add domains and press Enter"
        size={6}
        display={
          authProvider.filterByDomain &&
          authProvider.filterByDomain.length > 0 ? (
            <Labels labels={authProvider.filterByDomain} />
          ) : (
            <PlaceholderText />
          )
        }
      />
      <CommonField
        name={"Created"}
        value={<RelativeTime date={authProvider.createdAt} />}
        size={6}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={authProvider.updatedAt} />}
        size={6}
      />
    </OverviewCard>
  );
};
