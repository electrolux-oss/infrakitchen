import { Box } from "@mui/material";

import { formatLabel } from "../../common";
import {
  CommonField,
  getProviderValue,
  getTextValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { IntegrationResponse } from "../types";

export interface TemplateConfigurationProps {
  integration: IntegrationResponse;
}

export const IntegrationConfiguration = ({
  integration,
}: TemplateConfigurationProps) => {
  return (
    <PropertyCollapseCard
      id={`integration-config`}
      title="Integration Configuration"
      subtitle="Configuration details of this integration"
      expanded={true}
    >
      <OverviewCard>
        <CommonField
          name={"Integration Provider"}
          value={
            <Box height="auto">
              {getProviderValue(integration.integration_provider)}
            </Box>
          }
        />
        <CommonField
          name={"Integration Type"}
          value={getTextValue(integration.integration_type)}
        />
        {Object.entries(integration.configuration).map(([k, v]) => {
          if (k !== "integration_provider" && v !== null && v !== "") {
            return (
              <CommonField key={`${k}${v}`} name={formatLabel(k)} value={v} />
            );
          }
        })}
      </OverviewCard>
    </PropertyCollapseCard>
  );
};
