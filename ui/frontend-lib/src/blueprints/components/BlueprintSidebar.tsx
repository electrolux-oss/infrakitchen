import { useCallback } from "react";

import { useNavigate } from "react-router";

import StorageIcon from "@mui/icons-material/Storage";
import TuneIcon from "@mui/icons-material/Tune";
import { Box, Chip, Grid, TextField } from "@mui/material";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { Entity } from "../../common/components/entities/Entity";
import { CommonField } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { GqlBlueprint, UPDATE_BLUEPRINT_MUTATION } from "../graphql";
import { BlueprintUpdateFieldInput } from "../graphql/mutations";

export interface BlueprintSidebarProps {
  blueprint: GqlBlueprint;
}

/**
 * GitHub-style right sidebar for the blueprint detail page: groups the
 * blueprint's description, status, building blocks and history so the main
 * column can focus on its wiring and workflows.
 */
export const BlueprintSidebar = ({ blueprint }: BlueprintSidebarProps) => {
  const { refreshEntity } = useEntityProvider();
  const { ikApi, linkPrefix } = useConfig();
  const { checkActionPermission } = usePermissionProvider();
  const navigate = useNavigate();

  const canEdit = checkActionPermission("api:blueprint", "write");

  const saveField = useCallback(
    async (input: BlueprintUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_BLUEPRINT_MUTATION, {
          id: blueprint.id,
          input,
        });
        notify("Blueprint updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, blueprint.id, refreshEntity],
  );

  const externalTemplates = blueprint.externalTemplates || [];

  const constants =
    (blueprint.configuration?.constants as Array<{
      id: string;
      name: string;
    }>) || [];

  return (
    <EntitySidebar ariaLabel="Blueprint details">
      <SidebarSection title="About">
        <CommonEditableField<string>
          name="Name"
          canEdit={canEdit}
          value={blueprint.name}
          ariaLabel="Edit name"
          display={<span>{blueprint.name}</span>}
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
          value={blueprint.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <EditableTagsField
          value={blueprint.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <Grid size={12}>
          <StatusChip status={blueprint.status} />
        </Grid>
      </SidebarSection>

      <SidebarSection title="Templates" count={blueprint.templates.length}>
        <Grid size={12}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {blueprint.templates.map((t) => (
              <Entity key={t.id} entity={t} />
            ))}
          </Box>
        </Grid>
      </SidebarSection>

      {externalTemplates.length > 0 && (
        <SidebarSection
          title="Input Templates"
          count={externalTemplates.length}
        >
          <Grid size={12}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {externalTemplates.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  variant="outlined"
                  color="warning"
                  icon={<StorageIcon />}
                  onClick={() => navigate(`${linkPrefix}templates/${t.id}`)}
                />
              ))}
            </Box>
          </Grid>
        </SidebarSection>
      )}

      {constants.length > 0 && (
        <SidebarSection title="Constants" count={constants.length}>
          <Grid size={12}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {constants.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  variant="outlined"
                  color="secondary"
                  icon={<TuneIcon />}
                />
              ))}
            </Box>
          </Grid>
        </SidebarSection>
      )}

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            blueprint.creator ? (
              <Entity entity={{ ...blueprint.creator, entityType: "user" }} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={blueprint.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={blueprint.updatedAt} />}
          size={6}
        />
        <CommonField
          name="Revision"
          value={blueprint.revisionNumber}
          size={12}
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
