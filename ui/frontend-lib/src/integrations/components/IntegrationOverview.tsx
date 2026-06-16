import { useCallback } from "react";

import { TextField } from "@mui/material";

import { CommonField } from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { sameStringSet } from "../../common/utils";
import { IconField } from "../../icons/Icons";
import {
  IntegrationUpdateFieldInput,
  UPDATE_INTEGRATION_MUTATION,
} from "../graphql/mutations";
import { IntegrationResponse } from "../types";

export interface IntegrationAboutProps {
  integration: IntegrationResponse;
}

export const IntegrationOverview = ({ integration }: IntegrationAboutProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:integration", "write");

  const saveField = useCallback(
    async (input: IntegrationUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_INTEGRATION_MUTATION, {
          id: integration.id,
          input,
        });
        notify("Integration updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, integration.id, refreshEntity],
  );

  return (
    <OverviewCard
      name={integration.name}
      description={integration.description || "No description"}
      icon={IconField(integration.integration_provider)}
      chip={integration.integration_type}
    >
      <CommonEditableField<string>
        name={"Name"}
        canEdit={canEdit}
        value={integration.name}
        ariaLabel="Edit name"
        display={<span>{integration.name}</span>}
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
        name={"Status"}
        value={<StatusChip status={integration.status} />}
        size={6}
      />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={integration.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{integration.description || "No description"}</span>}
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
      <CommonField
        name={"Created"}
        value={
          <RelativeTime
            date={integration.created_at}
            user={integration.creator}
          />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={integration.updated_at} />}
      />
      <CommonEditableField<string[]>
        name={"Labels"}
        canEdit={canEdit}
        value={integration.labels}
        ariaLabel="Edit labels"
        isEqual={sameStringSet}
        display={<Labels labels={integration.labels} />}
        onSave={(value) => saveField({ labels: value })}
        renderEditor={({ value, onChange }) => (
          <StringTagEditor
            value={value}
            onChange={onChange}
            label="Labels"
            helperText="Press Enter to add a label"
          />
        )}
        size={12}
      />
    </OverviewCard>
  );
};
