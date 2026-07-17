import { useCallback, useState } from "react";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  FormControlLabel,
} from "@mui/material";

import { CommonField, getTextValue } from "../../common/components/CommonField";
import TagInput from "../../common/components/inputs/TagInput";
import { OverviewCard } from "../../common/components/OverviewCard";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  ResourceUpdateFieldInput,
  UPDATE_RESOURCE_MUTATION,
} from "../graphql/mutations";
import { DependencyVariable } from "../types";

export interface DependencyConfigurationProps {
  resource: {
    id: string;
    dependencyTags: DependencyVariable[] | null;
    dependencyConfig: DependencyVariable[] | null;
  };
  updateMutation?: string;
  toUpdateInput?: (input: ResourceUpdateFieldInput) => Record<string, any>;
  permissionEntity?: string;
}

const getDependencyVariables = (variables: DependencyVariable[]) => {
  if (!variables || variables.length === 0) {
    return getTextValue("-");
  }
  return (
    <Box sx={{ ml: 3 }}>
      {variables.map((variable) => (
        <Box
          key={variable.name}
          sx={{
            display: "grid",
            gridTemplateColumns: "300px 150px 200px",
            alignItems: "center",
            columnGap: 5,
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "text.primary" }}
            fontWeight="bold"
          >
            {variable.name}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {variable.value}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={variable.inherited_by_children ?? false}
                  disableRipple
                  sx={{
                    pointerEvents: "none",
                    cursor: "default",
                  }}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  Inherited By Children
                </Typography>
              }
              sx={{
                pointerEvents: "none",
                cursor: "default",
              }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

interface DependencyEditDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initialValue: DependencyVariable[];
  onSave: (value: DependencyVariable[]) => Promise<void>;
}

const DependencyEditDialog = ({
  open,
  onClose,
  title,
  initialValue,
  onSave,
}: DependencyEditDialogProps) => {
  const [draft, setDraft] = useState<DependencyVariable[]>(initialValue);
  const [saving, setSaving] = useState(false);
  const [errors] = useState<Record<string, any>>({});

  const handleOpen = () => {
    setDraft(
      initialValue.map((t) => ({
        name: t.name,
        value: t.value,
        inherited_by_children: t.inherited_by_children,
      })),
    );
  };

  const handleSave = async () => {
    const hasIncomplete = draft.some(
      (entry) => !entry.name?.trim() || !entry.value?.trim(),
    );
    if (hasIncomplete) {
      notifyError(new Error("All entries must have both a name and a value"));
      return;
    }

    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } catch {
      // Error surfaced by onSave; keep dialog open
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      TransitionProps={{ onEnter: handleOpen }}
    >
      <DialogTitle>Edit {title}</DialogTitle>
      <DialogContent>
        <TagInput
          label={title}
          errors={errors}
          value={draft}
          onChange={setDraft}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const DependencyConfiguration = ({
  resource,
  updateMutation = UPDATE_RESOURCE_MUTATION,
  toUpdateInput = (input) => input,
  permissionEntity = "api:resource",
}: DependencyConfigurationProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission(permissionEntity, "write");

  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [configsDialogOpen, setConfigsDialogOpen] = useState(false);

  const saveField = useCallback(
    async (input: ResourceUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(updateMutation, {
          id: resource.id,
          input: toUpdateInput(input),
        });
        notify("Resource updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, refreshEntity, resource.id, toUpdateInput, updateMutation],
  );

  return (
    <Box sx={{ gap: 2, display: "flex", flexDirection: "column" }}>
      <OverviewCard
        name={
          <Typography variant="h5" component="h2">
            Tags
          </Typography>
        }
      >
        <CommonField
          name="Dependency Tags"
          size={12}
          value={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                width: "100%",
              }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                {getDependencyVariables(
                  resource.dependencyTags as DependencyVariable[],
                )}
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setTagsDialogOpen(true)}
                disabled={!canEdit}
              >
                Edit
              </Button>
            </Box>
          }
        />
        <DependencyEditDialog
          open={tagsDialogOpen}
          onClose={() => setTagsDialogOpen(false)}
          title="Dependency Tags"
          initialValue={resource.dependencyTags as DependencyVariable[]}
          onSave={(value) => saveField({ dependencyTags: value })}
        />
      </OverviewCard>
      <OverviewCard
        name={
          <Typography variant="h5" component="h2">
            Configs
          </Typography>
        }
      >
        <CommonField
          name="Dependency Configs"
          size={12}
          value={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                width: "100%",
              }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                {getDependencyVariables(
                  resource.dependencyConfig as DependencyVariable[],
                )}
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setConfigsDialogOpen(true)}
                disabled={!canEdit}
              >
                Edit
              </Button>
            </Box>
          }
        />
        <DependencyEditDialog
          open={configsDialogOpen}
          onClose={() => setConfigsDialogOpen(false)}
          title="Dependency Configs"
          initialValue={resource.dependencyConfig as DependencyVariable[]}
          onSave={(value) => saveField({ dependencyConfig: value })}
        />
      </OverviewCard>
    </Box>
  );
};
