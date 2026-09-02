import { ReactNode, useCallback, useMemo, useState } from "react";

import {
  Box,
  Button,
  Chip,
  Grid,
  TextField,
  Typography,
} from "@mui/material";

import { useConfig } from "../../common";
import {
  CommonField,
  GetEntityLink,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditAffordance } from "../../common/components/editors/EditAffordance";
import { InlineCode } from "../../common/components/InlineCode";
import { OverviewCard } from "../../common/components/OverviewCard";
import { PlaceholderText } from "../../common/components/PlaceholderDescription";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { solidChipColorSx } from "../../common/utils/softChip";
import { PendingChangeBadge } from "../../common/components/PendingChangeBadge";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import VersionLifecycleStateChip from "../../common/VersionLifecycleStateChip";
import { getVersionLifecycleStateColor } from "../../common/VersionLifecycleStateChip";
import { IkEntity } from "../../types";
import { VERSION_LIFECYCLE_STATE } from "../../utils/constants";
import { GqlResource } from "../graphql";
import {
  ResourceUpdateFieldInput,
  UPDATE_RESOURCE_MUTATION,
} from "../graphql/mutations";
import { VariableInput, VariableOutput } from "../types";

import { ResourceVariablesEditDialog } from "./variables/ResourceVariablesEditDialog";
import { CODE_FONT_FAMILY } from "../../common/theme";

export interface TemplateConfigurationProps {
  resource: GqlResource;
}

const formatVariableValue = (value: any) => {
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const getSourceCodeVariables = (
  variables: VariableInput[] | VariableOutput[],
  options?: { showType?: boolean; emptyMessage?: string },
) => {
  const { showType = false, emptyMessage = "No variables found." } =
    options ?? {};

  if (!variables || variables.length === 0) {
    return (
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", ml: 3, mr: 3 }}
      >
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Box sx={{ ml: 3, mr: 3 }}>
      {[...variables]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((variable) => (
          <Box
            key={variable.name}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: "var(--template-surface-radius)",
              p: 1.5,
              mb: 1.5,
            }}
          >
            <Grid container spacing={2} sx={{ alignItems: "center" }}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, fontFamily: CODE_FONT_FAMILY }}
                    >
                      {variable.name}
                    </Typography>
                    {showType && (variable as VariableInput).type && (
                      <InlineCode>{(variable as VariableInput).type}</InlineCode>
                    )}
                    {variable.sensitive && (
                      <Chip
                        label="sensitive"
                        sx={solidChipColorSx("secondary")}
                      />
                    )}
                  </Box>
                  {variable.description && (
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      {variable.description}
                    </Typography>
                  )}
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Value
                </Typography>
                {variable.sensitive ? (
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", fontStyle: "italic" }}
                  >
                    Hidden (sensitive)
                  </Typography>
                ) : variable.value === null || variable.value === undefined ? (
                  <PlaceholderText />
                ) : (
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 1,
                      fontSize: "0.75rem",
                      fontFamily: CODE_FONT_FAMILY,
                      bgcolor: "action.hover",
                      borderRadius: "var(--template-surface-radius)",
                      overflow: "auto",
                    }}
                  >
                    {formatVariableValue(variable.value)}
                  </Box>
                )}
              </Grid>
            </Grid>
          </Box>
        ))}
    </Box>
  );
};

export const TemplateConfiguration = ({
  resource,
}: TemplateConfigurationProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity, hasPendingChange } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:resource", "write");
  const canEditStorage = checkActionPermission("api:storage", "admin");
  const sourceCodeVersionLifecycleState =
    resource.sourceCodeVersion?.lifecycleState?.toLowerCase();
  const showSourceCodeVersionLifecycleState =
    !!sourceCodeVersionLifecycleState &&
    sourceCodeVersionLifecycleState !== VERSION_LIFECYCLE_STATE.UNKNOWN;
  const sourceCodeVersionLifecycleColor = getVersionLifecycleStateColor(
    sourceCodeVersionLifecycleState,
  );
  const sourceCodeVersionTextColor =
    sourceCodeVersionLifecycleColor === "success"
      ? "success.main"
      : sourceCodeVersionLifecycleColor === "info"
        ? "info.main"
        : sourceCodeVersionLifecycleColor === "warning"
          ? "warning.main"
          : sourceCodeVersionLifecycleColor === "error"
            ? "error.main"
            : "text.primary";
  const [isStorageUnlocked, setIsStorageUnlocked] = useState(false);
  const [isStoragePathUnlocked, setIsStoragePathUnlocked] = useState(false);
  const [variablesDialogOpen, setVariablesDialogOpen] = useState(false);

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const storageFilter = useMemo(
    () => ({
      integration_id: resource.integrationIds?.map((i) => i.id),
    }),
    [resource.integrationIds],
  );

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

  const handleVariablesSave = useCallback(
    async (variables: VariableInput[], sourceCodeVersionId?: string | null) => {
      const input: ResourceUpdateFieldInput = { variables };
      if (sourceCodeVersionId !== undefined) {
        input.sourceCodeVersionId = sourceCodeVersionId;
      }
      await saveField(input);
    },
    [saveField],
  );

  const withPendingChange = useCallback(
    (display: ReactNode, key: string) => {
      if (!hasPendingChange(key)) {
        return display;
      }

      const isEmptyDisplay =
        display === null || display === undefined || display === "";

      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 1,
          }}
        >
          {" "}
          {isEmptyDisplay ? <PlaceholderText /> : display}
          <PendingChangeBadge />
        </Box>
      );
    },
    [hasPendingChange],
  );
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <OverviewCard name="Template Configuration">
        {resource.template && (
          <CommonField
            name="Template"
            value={<GetReferenceUrlValue {...resource.template} />}
          />
        )}
        <CommonField
          name="Template Version"
          value={withPendingChange(
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                maxWidth: "100%",
                // Reveal the edit affordance on hover/focus, like other editable fields.
                "&:hover .inline-edit-action, &:focus-within .inline-edit-action":
                  {
                    opacity: 1,
                  },
              }}
            >
              {resource.sourceCodeVersion?.sourceCode ? (
                <GetEntityLink
                  {...resource.sourceCodeVersion}
                  name={
                    resource.sourceCodeVersion?.sourceCodeVersion ||
                    resource.sourceCodeVersion?.sourceCodeBranch ||
                    "Unnamed Version"
                  }
                  sx={{
                    color: sourceCodeVersionTextColor,
                    fontWeight:
                      sourceCodeVersionLifecycleColor === "warning" ? 600 : 500,
                    textDecorationColor: sourceCodeVersionTextColor,
                  }}
                />
              ) : (
                <PlaceholderText />
              )}
              {showSourceCodeVersionLifecycleState ? (
                <VersionLifecycleStateChip
                  lifecycleState={sourceCodeVersionLifecycleState}
                />
              ) : null}
              {canEdit && (
                <EditAffordance
                  className="inline-edit-action"
                  onClick={() => setVariablesDialogOpen(true)}
                  ariaLabel="Change template version"
                />
              )}
            </Box>,
            "source_code_version_id",
          )}
        />
        {canEditStorage &&
          resource.integrationIds &&
          resource.integrationIds?.length > 0 && (
            <>
              <CommonEditableField<string | null>
                name="Storage"
                canEdit={canEditStorage && isStorageUnlocked}
                lock={{
                  locked: !isStorageUnlocked,
                  onToggle: () => setIsStorageUnlocked((unlocked) => !unlocked),
                  lockedTitle: "Storage is locked",
                  lockedDescription:
                    "Changing storage can cause OpenTofu/Terraform state issues. Click to unlock and edit.",
                  unlockedTitle: "Storage editing is enabled",
                  unlockedDescription:
                    "Click the lock to lock it again when you are done.",
                }}
                value={resource.storage?.id ?? null}
                ariaLabel="Edit storage"
                display={withPendingChange(
                  resource.storage ? (
                    <GetReferenceUrlValue {...resource.storage} />
                  ) : null,
                  "storage_id",
                )}
                onSave={(value) => saveField({ storageId: value })}
                renderEditor={({ value, onChange }) => (
                  <ReferenceInput
                    ikApi={ikApi}
                    entity_name="storages"
                    buffer={buffer}
                    bufferKey="storages"
                    showFields={["name", "storage_provider"]}
                    fields={["name", "storage_provider", "state"]}
                    setBuffer={setBuffer}
                    filter={storageFilter}
                    value={value}
                    onChange={onChange}
                    getOptionDisabled={(option: any) =>
                      option.state !== "PROVISIONED"
                    }
                    ariaLabel="Storage"
                    placeholder="Select storage for TF state…"
                    required
                    helpertext="Keep this value unchanged unless you are intentionally migrating OpenTofu/Terraform state."
                  />
                )}
              />

              {resource.storage && (
                <CommonEditableField<string | null>
                  name="Storage Path"
                  canEdit={canEditStorage && isStoragePathUnlocked}
                  lock={{
                    locked: !isStoragePathUnlocked,
                    onToggle: () =>
                      setIsStoragePathUnlocked((unlocked) => !unlocked),
                    lockedTitle: "Storage path is locked",
                    lockedDescription:
                      "Changing the storage path can cause OpenTofu/Terraform state issues. Click to unlock and edit.",
                    unlockedTitle: "Storage path editing is enabled",
                    unlockedDescription:
                      "Click the lock to lock it again when you are done.",
                  }}
                  value={resource.storagePath ?? null}
                  ariaLabel="Edit storage path"
                  display={withPendingChange(
                    resource.storagePath ? (
                      <span>{resource.storagePath}</span>
                    ) : null,
                    "storage_path",
                  )}
                  onSave={(value) => saveField({ storagePath: value })}
                  renderEditor={({ value, onChange }) => (
                    <TextField
                      value={value ?? ""}
                      onChange={(e) => onChange(e.target.value || null)}
                      slotProps={{ input: { "aria-label": "Storage Path" } }}
                      fullWidth
                      margin="normal"
                      autoFocus
                      helperText="By default InfraKitchen uses `service-catalog/{template}/{resource_name}/terraform.tfstate` as the path."
                    />
                  )}
                />
              )}
            </>
          )}
        {!canEditStorage && (
          <>
            <CommonField
              name="Storage"
              value={withPendingChange(
                resource.storage ? (
                  <GetReferenceUrlValue {...resource.storage} />
                ) : null,
                "storage_id",
              )}
            />
            <CommonField
              name="Storage Path"
              value={withPendingChange(resource.storagePath, "storage_path")}
            />
          </>
        )}{" "}
      </OverviewCard>
      {resource.abstract === false && (
        <>
          <OverviewCard
            name={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {/* Inherit the card-title styling so this header matches the
                    plain-string titles used by the other overview cards. */}
                <Typography component="span" variant="inherit">
                  Input Variables
                </Typography>
                <Chip
                  label={String(resource.variables?.length ?? 0)}
                  sx={solidChipColorSx("info", undefined, undefined, true)}
                />
                {hasPendingChange("variables") && <PendingChangeBadge />}
              </Box>
            }
            actions={
              <Button
                onClick={() => setVariablesDialogOpen(true)}
                disabled={!canEdit}
              >
                Edit Configuration
              </Button>
            }
          >
            <Grid size={12}>
              {getSourceCodeVariables(resource.variables as VariableInput[], {
                showType: true,
                emptyMessage: "No input variables.",
              })}
            </Grid>
          </OverviewCard>
          <ResourceVariablesEditDialog
            open={variablesDialogOpen}
            onClose={() => setVariablesDialogOpen(false)}
            resource={resource}
            onSave={handleVariablesSave}
          />
          <OverviewCard
            name={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {/* Inherit the card-title styling so this header matches the
                    plain-string titles used by the other overview cards. */}
                <Typography component="span" variant="inherit">
                  Output Values
                </Typography>
                <Chip
                  label={String(resource.outputs?.length ?? 0)}
                  sx={solidChipColorSx("info", undefined, undefined, true)}
                />
              </Box>
            }
          >
            <Grid size={12}>
              {getSourceCodeVariables(resource.outputs as VariableOutput[], {
                emptyMessage: "No output values.",
              })}
            </Grid>
          </OverviewCard>
        </>
      )}
    </Box>
  );
};
