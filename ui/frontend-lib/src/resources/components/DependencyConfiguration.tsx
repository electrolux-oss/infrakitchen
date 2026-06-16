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
import { DependencyVariable, ResourceResponse } from "../types";

export interface DependencyConfigurationProps {
  resource: ResourceResponse;
}

interface DependencyTag {
  name: string;
  value: string;
  inherited_by_children: boolean;
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
  initialValue: DependencyTag[];
  onSave: (value: DependencyTag[]) => Promise<void>;
}

const DependencyEditDialog = ({
  open,
  onClose,
  title,
  initialValue,
  onSave,
}: DependencyEditDialogProps) => {
  const [draft, setDraft] = useState<DependencyTag[]>(initialValue);
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
}: DependencyConfigurationProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:resource", "write");

  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [configsDialogOpen, setConfigsDialogOpen] = useState(false);

  const saveField = useCallback(
    async (input: ResourceUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_RESOURCE_MUTATION, {
          id: resource.id,
          input,
        });
        notify("Resource updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, resource.id, refreshEntity],
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
                {getDependencyVariables(resource.dependency_tags)}
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
          initialValue={resource.dependency_tags as DependencyTag[]}
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
                {getDependencyVariables(resource.dependency_config)}
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
          initialValue={resource.dependency_config as DependencyTag[]}
          onSave={(value) => saveField({ dependencyConfig: value })}
        />
      </OverviewCard>
    </Box>
  );
};
