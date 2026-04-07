import { useState } from "react";

import InfoIcon from "@mui/icons-material/Info";
import SyncIcon from "@mui/icons-material/Sync";
import {
  Box,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import {
  CommonField,
  GetReferenceUrlValue,
  getTextValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { SourceCodeVersionLink } from "../../source_codes/components/SourceCodeVersionLink";
import { ResourceResponse, VariableInput, VariableOutput } from "../types";

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
        {variables
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
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    ikApi
      .patchRaw(`resources/${resource.id}/sync`, {})
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
          <CommonField
            name="Template Version"
            value={
              resource.source_code_version?.source_code ? (
                <SourceCodeVersionLink
                  source_code_version={resource.source_code_version}
                  name={
                    resource.source_code_version.source_code_version ||
                    resource.source_code_version.source_code_branch
                  }
                />
              ) : (
                "N/A"
              )
            }
          />
          {resource.integration_ids.length > 0 && (
            <CommonField
              name="Integrations"
              value={
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {resource.integration_ids.map((parent) => (
                    <span key={parent.id}>
                      <GetReferenceUrlValue
                        {...parent}
                        urlProvider={parent.integration_provider}
                      />
                    </span>
                  ))}
                </Box>
              }
              size={6}
            />
          )}
          {resource.secret_ids.length > 0 && (
            <CommonField
              name="Secrets"
              value={
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {resource.secret_ids.map((parent) => (
                    <span key={parent.id}>
                      <GetReferenceUrlValue {...parent} />
                    </span>
                  ))}
                </Box>
              }
              size={6}
            />
          )}
          {resource.storage && (
            <CommonField
              name="Storage"
              value={<GetReferenceUrlValue {...resource.storage} />}
            />
          )}
          {resource.storage_path && (
            <CommonField
              name={"Storage Path"}
              value={getTextValue(resource.storage_path || "N/A")}
              size={12}
            />
          )}
          {resource.workspace && (
            <CommonField
              name="Workspace"
              value={
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
              }
            />
          )}
        </Grid>
      </OverviewCard>

      {resource.abstract === false && (
        <>
          <OverviewCard name="Input Variables">
            {getSourceCodeVariables(resource.variables)}
          </OverviewCard>
          <OverviewCard name="Output Values">
            {getSourceCodeVariables(resource.outputs)}
          </OverviewCard>
        </>
      )}
    </Box>
  );
};
