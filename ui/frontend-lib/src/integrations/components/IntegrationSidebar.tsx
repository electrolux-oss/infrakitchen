import { useCallback } from "react";

import { Box, Chip, Grid, TextField } from "@mui/material";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { Entity } from "../../common/components/entities/Entity";
import {
  CommonField,
  getProviderValue,
} from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { solidChipColorSx } from "../../common/utils/softChip";
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
    <EntitySidebar ariaLabel="Integration details">
      <SidebarSection title="About">
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
          size={12}
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
        <Grid size={12}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <StatusChip status={integration.status} />
            <Chip
              label={integration.integrationType.toUpperCase()}
              sx={solidChipColorSx(
                integrationTypeChipColor(integration.integrationType),
              )}
            />
          </Box>
        </Grid>
        <CommonField
          name="Provider"
          value={getProviderValue(integration.integrationProvider)}
          size={12}
        />
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            integration.creator ? (
              <Entity entity={{ ...integration.creator, entityType: "user" }} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={integration.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={integration.updatedAt} />}
          size={6}
        />
        <CommonField
          name="Revision"
          value={integration.revisionNumber}
          size={12}
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
