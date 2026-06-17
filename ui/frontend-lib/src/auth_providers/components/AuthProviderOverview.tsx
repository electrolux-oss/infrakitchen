import { useCallback } from "react";

import { Checkbox, FormControlLabel, TextField } from "@mui/material";

import {
  CommonField,
  getBooleanLabel,
  getProviderValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { StringChips } from "../../common/components/editors/StringChips";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { sameStringSet } from "../../common/utils";
import {
  AuthProviderUpdateFieldInput,
  UPDATE_AUTH_PROVIDER_MUTATION,
} from "../graphql/mutations";
import { AuthProviderResponse } from "../types";

export interface AuthProviderAboutProps {
  authProvider: AuthProviderResponse;
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
    <OverviewCard
      name={authProvider.name}
      description={authProvider.description}
    >
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
            label="Name"
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
      />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={authProvider.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{authProvider.description || "No description"}</span>}
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
        name={"Enabled"}
        canEdit={canEdit}
        value={authProvider.enabled}
        ariaLabel="Edit enabled status"
        display={getBooleanLabel(authProvider.enabled)}
        onSave={(value) => saveField({ enabled: value })}
        renderEditor={({ value, onChange }) => (
          <FormControlLabel
            control={
              <Checkbox
                checked={value}
                onChange={(e) => onChange(e.target.checked)}
              />
            }
            label="Enabled"
          />
        )}
        size={6}
      />
      <CommonEditableField<string[]>
        name={"Filter By Domain"}
        canEdit={canEdit}
        value={authProvider.filterByDomain}
        ariaLabel="Edit filter by domain"
        isEqual={sameStringSet}
        display={
          authProvider.filterByDomain.length > 0 ? (
            <Labels labels={authProvider.filterByDomain} />
          ) : (
            <StringChips values={[]} />
          )
        }
        onSave={(value) => saveField({ filterByDomain: value })}
        renderEditor={({ value, onChange }) => (
          <StringTagEditor
            value={value}
            onChange={onChange}
            label="Filter By Domain"
            helperText="Add domains and press Enter"
          />
        )}
        size={6}
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
