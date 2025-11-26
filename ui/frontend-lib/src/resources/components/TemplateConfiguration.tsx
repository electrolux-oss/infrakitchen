import { Box, Grid, Tooltip, Typography } from "@mui/material";

import {
  getTextValue,
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
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
  return (
    <PropertyCollapseCard
      title={"Template Configuration"}
      expanded={true}
      id="resource-template-config"
    >
      <Grid container spacing={2}>
        <CommonField
          name={"Template"}
          value={<GetReferenceUrlValue {...resource.template} />}
        />
        <CommonField
          name={"Abstract"}
          value={getTextValue(resource.abstract)}
        />
        {resource.integration_ids.length > 0 && (
          <CommonField
            name={"Integrations"}
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
            name={"Secrets"}
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
            name={"Storage"}
            value={<GetReferenceUrlValue {...resource.storage} />}
          />
        )}
        {resource.workspace && (
          <CommonField
            name={"Workspace"}
            value={<GetReferenceUrlValue {...resource.workspace} />}
          />
        )}
        <CommonField
          name={"Template Version"}
          value={
            resource.source_code_version ? (
              <GetReferenceUrlValue {...resource.source_code_version} />
            ) : (
              "N/A"
            )
          }
        />
        {resource.abstract === false && (
          <>
            <Grid size={12}>
              <PropertyCollapseCard
                title={"Input Variables"}
                id="resource-template-input-vars"
              >
                {getSourceCodeVariables(resource.variables)}
              </PropertyCollapseCard>
            </Grid>
            <Grid size={12}>
              <PropertyCollapseCard
                title={"Output Values"}
                id="resource-template-output-vars"
              >
                {getSourceCodeVariables(resource.outputs)}
              </PropertyCollapseCard>
            </Grid>
          </>
        )}
      </Grid>
    </PropertyCollapseCard>
  );
};
