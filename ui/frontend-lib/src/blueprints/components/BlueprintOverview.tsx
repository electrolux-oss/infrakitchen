import { useCallback } from "react";

import { useNavigate } from "react-router";

import StorageIcon from "@mui/icons-material/Storage";
import TuneIcon from "@mui/icons-material/Tune";
import { Box, Chip, TextField } from "@mui/material";

import {
  CommonField,
  GetEntityLink,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";

import { GqlBlueprint, UPDATE_BLUEPRINT_MUTATION } from "../graphql";
import { BlueprintUpdateFieldInput } from "../graphql/mutations";

export const BlueprintOverview = () => {
  const { entity, refreshEntity } = useEntityProvider();
  const { ikApi, linkPrefix } = useConfig();
  const { checkActionPermission } = usePermissionProvider();
  const navigate = useNavigate();

  const canEdit = checkActionPermission("api:blueprint", "write");

  const blueprint = entity as GqlBlueprint | null;

  const saveField = useCallback(
    async (input: BlueprintUpdateFieldInput) => {
      if (!blueprint) return;
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
    [ikApi, blueprint, refreshEntity],
  );

  if (!blueprint) return null;

  const externalTemplates = blueprint.externalTemplates || [];

  const constants =
    (blueprint.configuration?.constants as Array<{
      id: string;
      name: string;
    }>) || [];

  return (
    <OverviewCard name={blueprint.name}>
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
        size={6}
      />
      <CommonField
        name="Status"
        value={<StatusChip status={blueprint.status} />}
        size={6}
      />{" "}
      <EditableDescriptionField
        value={blueprint.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
      />
      <CommonField
        name="Templates"
        value={
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {blueprint.templates.map((t) => (
              <GetEntityLink key={t.id} {...t} />
            ))}
          </Box>
        }
        size={6}
      />
      <CommonField
        name="Last Updated"
        value={<RelativeTime date={blueprint.updatedAt} />}
        size={6}
      />{" "}
      <EditableTagsField
        value={blueprint.labels || []}
        canEdit={canEdit}
        onSave={(value) => saveField({ labels: value })}
      />
      {externalTemplates.length > 0 && (
        <CommonField
          name="Input Templates"
          size={6}
          value={
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
          }
        />
      )}
      {constants.length > 0 && (
        <CommonField
          name="Constants"
          size={6}
          value={
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
          }
        />
      )}
    </OverviewCard>
  );
};
