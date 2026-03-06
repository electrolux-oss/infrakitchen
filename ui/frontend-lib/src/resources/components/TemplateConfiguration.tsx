import { useState } from "react";

import SyncIcon from "@mui/icons-material/Sync";
import { Box, Grid, IconButton, Tooltip, Typography } from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import {
  getTextValue,
  CommonField,
  GetReferenceUrlValue,
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
    <Box sx={{ ml: 3, mt: 2 }}>
      {variables.map((variable) => (
        <Box
          key={variable.name}
          sx={{
            display: "grid",
            gridTemplateColumns: "400px 1fr",
            alignItems: "center",
            columnGap: 2,
            mb: 2,
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
            {typeof variable.value === "object" ? (
              <Tooltip title={JSON.stringify(variable.value)}>
                <Typography component="span">
                  {JSON.stringify(variable.value).length > 50
                    ? JSON.stringify(variable.value).slice(0, 50) + "..."
                    : JSON.stringify(variable.value)}
                </Typography>
              </Tooltip>
            ) : (
              variable.value.toString()
            )}
          </Typography>
        </Box>
      ))}
    </Box>
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
