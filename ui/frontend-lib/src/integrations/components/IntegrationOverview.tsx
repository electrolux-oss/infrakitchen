import { useCallback } from "react";

import { TextField } from "@mui/material";

import { CommonField } from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { IconField } from "../../icons/Icons";
import { GqlIntegration } from "../graphql";
import { integrationTypeChipColor } from "../types";
import {
  IntegrationUpdateFieldInput,
  UPDATE_INTEGRATION_MUTATION,
} from "../graphql/mutations";

export interface IntegrationAboutProps {
  integration: GqlIntegration;
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
      icon={IconField(integration.integrationProvider)}
      chip={integration.integrationType}
      chipColor={integrationTypeChipColor(integration.integrationType)}
      chipVariant="solid"
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
            slotProps={{ input: { "aria-label": "Name" } }}
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
      />{" "}
      <EditableDescriptionField
        value={integration.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime
            date={integration.createdAt}
            user={integration.creator}
          />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={integration.updatedAt} />}
      />{" "}
      <EditableTagsField
        value={integration.labels || []}
        canEdit={canEdit}
        onSave={(value) => saveField({ labels: value })}
      />
    </OverviewCard>
  );
};
