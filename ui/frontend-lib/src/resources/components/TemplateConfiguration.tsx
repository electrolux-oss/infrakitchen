import { useCallback, useMemo, useState } from "react";

import InfoIcon from "@mui/icons-material/Info";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SyncIcon from "@mui/icons-material/Sync";
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

import { PermissionWrapper, useConfig } from "../../common";
import {
  CommonField,
  GetEntityLink,
  GetReferenceUrlValue,
  getTextValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { OverviewCard } from "../../common/components/OverviewCard";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { IkEntity } from "../../types";
import {
  ResourceUpdateFieldInput,
  SYNC_WORKSPACE_MUTATION,
  UPDATE_RESOURCE_MUTATION,
} from "../graphql/mutations";
import { ResourceResponse, VariableInput, VariableOutput } from "../types";

import { ResourceVariablesEditDialog } from "./variables/ResourceVariablesEditDialog";

export interface TemplateConfigurationProps {
  resource: ResourceResponse;
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
}: TemplateConfigurationProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:resource", "write");
  const canEditStorage = checkActionPermission("api:storage", "admin");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStorageEditable, setIsStorageEditable] = useState(false);
  const [variablesDialogOpen, setVariablesDialogOpen] = useState(false);

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const scvFilter = useMemo(
    () =>
      resource.template?.id ? { template_id: resource.template.id } : undefined,
    [resource.template?.id],
  );

  const storageFilter = useMemo(
    () => ({
      integration_id: resource.integration_ids.map((i) => i.id),
    }),
    [resource.integration_ids],
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

  const handleSync = () => {
    setIsSyncing(true);
    ikApi
      .graphqlRequest(SYNC_WORKSPACE_MUTATION, { id: resource.id })
      .then(() => {
        notify("Sent sync workspace request", "success");
      })
      .catch((error) => {
        notifyError(error);
      })
      .finally(() => {
        setIsSyncing(false);
      });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <OverviewCard name="Overview">
        <Grid container spacing={2} sx={{ ml: 3, mt: 2 }}>
          <CommonField
            name="Template"
            value={<GetReferenceUrlValue {...resource.template} />}
          />
          <CommonEditableField<string | null>
            name="Template Version"
            canEdit={canEdit}
            value={resource.source_code_version?.id ?? null}
            ariaLabel="Edit template version"
            display={
              resource.source_code_version?.source_code ? (
                <GetEntityLink
                  {...resource.source_code_version}
                  name={
                    resource.source_code_version?.sourceCodeVersion ||
                    resource.source_code_version?.sourceCodeBranch
                  }
                />
              ) : null
            }
            onSave={(value) => saveField({ sourceCodeVersionId: value })}
            renderEditor={({ value, onChange }) => (
              <ReferenceInput
                ikApi={ikApi}
                entity_name="source_code_versions"
                buffer={buffer}
                setBuffer={setBuffer}
                getOptionDisabled={(option: any) => option.status !== "done"}
                filter={scvFilter}
                value={value}
                onChange={onChange}
                label="Source Code Version"
              />
            )}
          />
          <CommonField
            name="Integrations"
            value={
              resource.integration_ids.length > 0 ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {resource.integration_ids.map((parent) => (
                    <span key={parent.id}>
                      <GetReferenceUrlValue
                        {...parent}
                        urlProvider={parent.integrationProvider}
                      />
                    </span>
                  ))}
                </Box>
              ) : null
            }
            size={6}
          />
          <CommonField
            name="Secrets"
            value={
              resource.secret_ids.length > 0 ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {resource.secret_ids.map((parent) => (
                    <span key={parent.id}>
                      <GetReferenceUrlValue {...parent} />
                    </span>
                  ))}
                </Box>
              ) : null
            }
            size={6}
          />

          {canEditStorage && resource.integration_ids.length > 0 && (
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
                display={
                  resource.storage ? (
                    <GetReferenceUrlValue {...resource.storage} />
                  ) : null
                }
                onSave={(value) => saveField({ storageId: value })}
                renderEditor={({ value, onChange }) => (
                  <ReferenceInput
                    ikApi={ikApi}
                    entity_name="storages"
                    buffer={buffer}
                    bufferKey="storages"
                    showFields={["name", "storage_provider"]}
                    setBuffer={setBuffer}
                    filter={storageFilter}
                    value={value}
                    onChange={onChange}
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
                  value={resource.storage_path}
                  ariaLabel="Edit storage path"
                  disabledTooltip="Unlock the storage field first"
                  display={
                    resource.storage_path ? (
                      <span>{resource.storage_path}</span>
                    ) : null
                  }
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
                value={
                  resource.storage ? (
                    <GetReferenceUrlValue {...resource.storage} />
                  ) : null
                }
              />
              <CommonField name="Storage Path" value={resource.storage_path} />
            </>
          )}

          <CommonField
            name="Workspace"
            value={
              resource.workspace ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <GetReferenceUrlValue {...resource.workspace} />
                  <PermissionWrapper
                    requiredPermission="api:resource"
                    permissionAction="admin"
                  >
                    <Tooltip title="Sync workspace">
                      <span>
                        <IconButton
                          size="small"
                          onClick={handleSync}
                          disabled={isSyncing}
                          sx={{ "& .MuiSvgIcon-root": { fontSize: "1.2rem" } }}
                        >
                          <SyncIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </PermissionWrapper>
                </Box>
              ) : null
            }
          />
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
            {getSourceCodeVariables(resource.variables)}
          </OverviewCard>
          <ResourceVariablesEditDialog
            open={variablesDialogOpen}
            onClose={() => setVariablesDialogOpen(false)}
            resource={resource}
            onSave={(variables) => saveField({ variables })}
          />
          <OverviewCard name="Output Values">
            {getSourceCodeVariables(resource.outputs)}
          </OverviewCard>
        </>
      )}
    </Box>
  );
};
