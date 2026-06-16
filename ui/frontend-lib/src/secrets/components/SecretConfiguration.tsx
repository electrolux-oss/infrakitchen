import { useCallback } from "react";

import { Box, Typography } from "@mui/material";

import { formatLabel } from "../../common";
import {
  CommonField,
  getProviderValue,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  SecretUpdateFieldInput,
  UPDATE_SECRET_MUTATION,
} from "../graphql/mutations";
import { CustomSecret, SecretResponse, SecretUpdate } from "../types";

import { SecretConfigurationField } from "./SecretConfigurationField";

export interface SecretConfigurationProps {
  secret: SecretResponse;
}

const getCustomSecrets = (secrets: CustomSecret[]) => {
  if (!secrets || secrets.length === 0) {
    return null;
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
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:secret", "write");

  const saveConfiguration = useCallback(
    async (configuration: SecretUpdate["configuration"]) => {
      const input: SecretUpdateFieldInput = {
        configuration,
        // secret_provider is the Pydantic discriminator for the configuration
        // union type; the backend needs it to deserialize the correct variant.
        secretProvider: secret.secret_provider,
      };
      try {
        await ikApi.graphqlRequest(UPDATE_SECRET_MUTATION, {
          id: secret.id,
          input,
        });
        notify("Secret updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, secret.id, secret.secret_provider, refreshEntity],
  );

  return (
    <OverviewCard name="Secret Configuration">
      <CommonField
        name={"Integration"}
        value={
          secret.integration ? (
            <GetReferenceUrlValue
              {...secret.integration}
              urlProvider={secret.integration.integration_provider}
            />
          ) : null
        }
      />
      <CommonField
        name={"Secret Provider"}
        value={getProviderValue(secret.secret_provider)}
      />
      <CommonField name={"Secret Type"} value={secret.secret_type} />
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
      <SecretConfigurationField
        secret={secret}
        canEdit={canEdit}
        onSave={saveConfiguration}
      />
    </OverviewCard>
  );
};
