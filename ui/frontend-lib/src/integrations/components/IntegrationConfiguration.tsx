import { Box } from "@mui/material";

import { formatLabel } from "../../common";
import {
  CommonField,
  getProviderValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { IntegrationResponse } from "../types";

import { IntegrationConfigurationEditor } from "./IntegrationConfigurationEditor";

export interface TemplateConfigurationProps {
  integration: IntegrationResponse;
}

export const IntegrationConfiguration = ({
  integration,
}: TemplateConfigurationProps) => {
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:integration", "write");

  return (
    <OverviewCard>
      <CommonField
        name={"Integration Provider"}
        value={
          <Box height="auto">
            {getProviderValue(integration.integrationProvider)}
          </Box>
        }
      />
      <CommonField
        name={"Integration Type"}
        value={integration.integrationType}
      />
      {Object.entries(integration.configuration).map(([k, v]) => {
        if (k !== "integration_provider" && v !== null && v !== "") {
          return (
            <CommonField key={`${k}${v}`} name={formatLabel(k)} value={v} />
          );
        }
      })}
      <IntegrationConfigurationEditor
        integration={integration}
        canEdit={canEdit}
      />
    </OverviewCard>
  );
};
