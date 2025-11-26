import { Box, Typography } from "@mui/material";

import { formatLabel } from "../../common";
import {
  CommonField,
  getProviderValue,
  GetReferenceUrlValue,
  getTextValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { CustomSecret, SecretResponse } from "../types";

export interface SecretConfigurationProps {
  secret: SecretResponse;
}

const getCustomSecrets = (secrets: CustomSecret[]) => {
  if (!secrets || secrets.length === 0) {
    return getTextValue("-");
  }
  return (
    <Box sx={{ ml: 3 }}>
      {secrets.map((secret) => (
        <Box
          key={secret.name}
          sx={{
            display: "grid",
            gridTemplateColumns: "300px 150px 200px",
            alignItems: "center",
            columnGap: 5,
          }}
        >
          <Typography variant="body2" sx={{ color: "text.primary" }}>
            {secret.name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export const SecretConfiguration = ({ secret }: SecretConfigurationProps) => {
  return (
    <PropertyCollapseCard
      title={"Secret Configuration"}
      expanded={true}
      id="secret-config"
    >
      <OverviewCard>
        {secret.integration && (
          <CommonField
            name={"Integration"}
            value={
              <GetReferenceUrlValue
                {...secret.integration}
                urlProvider={secret.integration.integration_provider}
              />
            }
          />
        )}
        <CommonField
          name={"Secret Provider"}
          value={getProviderValue(secret.secret_provider)}
        />
        <CommonField
          name={"Secret Type"}
          value={getTextValue(secret.secret_type)}
        />
        {secret.secret_provider !== "custom" &&
          Object.entries(secret.configuration).map(([k, v]) => {
            return (
              <CommonField key={`${k}${v}`} name={formatLabel(k)} value={v} />
            );
          })}
        {secret.secret_provider === "custom" && (
          <CommonField
            name={"Secret List"}
            value={getCustomSecrets(secret.configuration.secrets)}
          />
        )}
      </OverviewCard>
    </PropertyCollapseCard>
  );
};
