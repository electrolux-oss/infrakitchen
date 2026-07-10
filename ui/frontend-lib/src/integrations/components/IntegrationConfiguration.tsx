import { Box } from "@mui/material";

import { formatLabel } from "../../common";
import {
  CommonField,
  getProviderValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { GqlIntegration } from "../graphql";

import { IntegrationConfigurationEditor } from "./IntegrationConfigurationEditor";
import { IntegrationOidcSection } from "./IntegrationOidcSection";

export interface TemplateConfigurationProps {
  integration: GqlIntegration;
}

// Internal OIDC signing material is not useful to display as raw key/value and the JWK is noisy.
// It is surfaced instead via the dedicated IntegrationOidcSection (issuer URL + JWKS download).
const HIDDEN_CONFIG_KEYS = new Set([
  "integration_provider",
  "gcp_oidc_signing_public_jwk",
  "gcp_oidc_signing_private_key",
]);

export const IntegrationConfiguration = ({
  integration,
}: TemplateConfigurationProps) => {
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:integration", "write");

  const isGcpOidc =
    integration.integrationProvider === "gcp" &&
    (integration.configuration || {})["gcp_auth_method"] ===
      "workload_identity_federation_oidc";

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
      {Object.entries(integration.configuration || {}).map(([k, v]) => {
        const value =
          k === "gcp_wif_pool_provider_audience" ||
          k === "gcp_wif_service_account_impersonation_url" ? (
            <Box
              sx={{
                color: "text.secondary",
                fontFamily: "monospace",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              {String(v)}
            </Box>
          ) : (
            v
          );

        if (!HIDDEN_CONFIG_KEYS.has(k) && v !== null && v !== "") {
          return (
            <CommonField key={`${k}${v}`} name={formatLabel(k)} value={value} />
          );
        }
      })}
      {isGcpOidc && <IntegrationOidcSection integrationId={integration.id} />}
      <IntegrationConfigurationEditor
        integration={integration}
        canEdit={canEdit}
      />
    </OverviewCard>
  );
};
