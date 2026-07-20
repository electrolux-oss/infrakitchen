import { ReactNode, useCallback, useMemo, useState } from "react";

import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import InfoIcon from "@mui/icons-material/Info";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Box,
  Button,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { useConfig } from "../../common";
import {
  CommonField,
  GetEntityLink,
  GetReferenceUrlValue,
  getTextValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { OverviewCard } from "../../common/components/OverviewCard";
import { PendingChangeBadge } from "../../common/components/PendingChangeBadge";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { IkEntity } from "../../types";
import { GqlResource } from "../graphql";
import {
  ResourceUpdateFieldInput,
  UPDATE_RESOURCE_MUTATION,
} from "../graphql/mutations";
import type { ResourcePendingChanges } from "../hooks";
import { VariableInput, VariableOutput } from "../types";

import { ResourceVariablesEditDialog } from "./variables/ResourceVariablesEditDialog";

export interface TemplateConfigurationProps {
  resource: GqlResource;
  pendingChanges?: ResourcePendingChanges;
}

const getSourceCodeVariables = (
  variables: VariableInput[] | VariableOutput[],
) => {
  if (!variables || variables.length === 0) {
    return getTextValue("-");
  }
  return (
    <Table
      sx={{
        ml: 3,
        mr: 3,
        "& td, & th": {
          py: 1,
          px: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: "bold", width: "30%" }}>Name</TableCell>
          <TableCell sx={{ fontWeight: "bold", width: "70%" }}>Value</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {[...variables]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((variable) => (
            <TableRow key={variable.name}>
              <TableCell sx={{ color: "text.primary" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {variable.name}
                  {variable.description && (
                    <Tooltip title={variable.description}>
                      <InfoIcon
                        sx={{ fontSize: "1rem", color: "text.secondary" }}
                      />
                    </Tooltip>
                  )}
                </Box>
              </TableCell>
              <TableCell sx={{ color: "text.secondary" }}>
                <Box
                  component="pre"
                  sx={{
                    p: 1,
                    overflow: "auto",
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    m: 0,
                  }}
                >
                  {typeof variable.value === "object"
                    ? JSON.stringify(variable.value, null, 2)
                    : variable.value.toString()}
                </Box>
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
};

export const TemplateConfiguration = ({
  resource,
  pendingChanges = null,
}: TemplateConfigurationProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:resource", "write");
  const canEditStorage = checkActionPermission("api:storage", "admin");
  const [isStorageEditable, setIsStorageEditable] = useState(false);
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

  const hasPendingChange = useCallback(
    (key: string) =>
      pendingChanges !== null &&
      Object.prototype.hasOwnProperty.call(pendingChanges, key),
    [pendingChanges],
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
          {isEmptyDisplay ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              None
            </Typography>
          ) : (
            display
          )}
          <PendingChangeBadge />
        </Box>
      );
    },
    [hasPendingChange],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <OverviewCard name="Overview">
        <Grid container spacing={2} sx={{ ml: 3, mt: 2 }}>
          {resource.template && (
            <CommonField
              name="Template"
              value={<GetReferenceUrlValue {...resource.template} />}
            />
          )}
          <CommonField
            name="Template Version"
            value={withPendingChange(
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {resource.sourceCodeVersion?.sourceCode ? (
                  <GetEntityLink
                    {...resource.sourceCodeVersion}
                    name={
                      resource.sourceCodeVersion?.sourceCodeVersion ||
                      resource.sourceCodeVersion?.sourceCodeBranch ||
                      "Unnamed Version"
                    }
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Not set
                  </Typography>
                )}
                {canEdit && (
                  <Tooltip title="Change template version">
                    <IconButton
                      size="small"
                      onClick={() => setVariablesDialogOpen(true)}
                      aria-label="Change template version"
                      sx={{ "& .MuiSvgIcon-root": { fontSize: "1.1rem" } }}
                    >
                      <EditOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>,
              "source_code_version_id",
            )}
          />

          {canEditStorage &&
            resource.integrationIds &&
            resource.integrationIds?.length > 0 && (
              <>
                <Grid size={12}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 1,
                    }}
                  >
                    <Tooltip
                      title={
                        isStorageEditable
                          ? "Lock storage field"
                          : "Unlock storage field"
                      }
                    >
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={() =>
                          setIsStorageEditable((editable) => !editable)
                        }
                      >
                        {isStorageEditable ? (
                          <LockOpenOutlinedIcon fontSize="small" />
                        ) : (
                          <LockOutlinedIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Typography variant="body2" color="warning.main">
                      {isStorageEditable
                        ? "Storage editing is enabled. Changing storage can cause OpenTofu/Terraform state issues."
                        : "Storage is locked. Click the lock icon to edit. Changing storage can cause OpenTofu/Terraform state issues."}
                    </Typography>
                  </Box>
                </Grid>

                <CommonEditableField<string | null>
                  name="Storage"
                  canEdit={canEditStorage && isStorageEditable}
                  value={resource.storage?.id ?? null}
                  ariaLabel="Edit storage"
                  disabledTooltip="Unlock the storage field first"
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
                      label="Select Storage for storing TF state"
                      required
                      helpertext="Keep this value unchanged unless you are intentionally migrating OpenTofu/Terraform state."
                    />
                  )}
                />

                {resource.storage && (
                  <CommonEditableField<string | null>
                    name="Storage Path"
                    canEdit={canEditStorage && isStorageEditable}
                    value={resource.storagePath ?? null}
                    ariaLabel="Edit storage path"
                    disabledTooltip="Unlock the storage field first"
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
                        label="Storage Path"
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
          )}
        </Grid>
      </OverviewCard>

      {resource.abstract === false && (
        <>
          <OverviewCard
            name={
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <span>Input Variables</span>
                {hasPendingChange("variables") && <PendingChangeBadge />}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setVariablesDialogOpen(true)}
                  disabled={!canEdit}
                >
                  Edit
                </Button>
              </Box>
            }
          >
            {getSourceCodeVariables(resource.variables as VariableInput[])}
          </OverviewCard>
          <ResourceVariablesEditDialog
            open={variablesDialogOpen}
            onClose={() => setVariablesDialogOpen(false)}
            resource={resource}
            pendingChanges={pendingChanges}
            onSave={handleVariablesSave}
          />
          <OverviewCard name="Output Values">
            {getSourceCodeVariables(resource.outputs as VariableOutput[])}
          </OverviewCard>
        </>
      )}
    </Box>
  );
};
