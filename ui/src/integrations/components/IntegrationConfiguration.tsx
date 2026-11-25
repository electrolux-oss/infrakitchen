import { useEffect, useState } from "react";

import { formatLabel } from "../../common";
import { BaseCard } from "../../common/components/cards/BaseCard";
import {
  CommonField,
  EntityReference,
  getProviderValue,
} from "../../common/components/fields/CommonField";
import { useConfig } from "../../common/context/ConfigContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { GqlIntegration, LINKED_INTEGRATION_QUERY } from "../graphql";

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

const LinkedIntegration = ({ id }: { id: string }) => {
  const { ikApi } = useConfig();
  const [integration, setIntegration] = useState<{
    name: string;
    integrationProvider: string;
  } | null>(null);

  useEffect(() => {
    ikApi
      .graphqlRequest<{
        integration: { name: string; integrationProvider: string } | null;
      }>(LINKED_INTEGRATION_QUERY, { id })
      .then((response) => setIntegration(response.integration))
      .catch(() => setIntegration(null));
  }, [ikApi, id]);

  return (
    <EntityReference
      id={id}
      entityName="integration"
      name={integration?.name ?? id}
      provider={integration?.integrationProvider}
    />
  );
};

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
    <BaseCard>
      <CommonField
        name={"Integration Provider"}
        value={
          <div className="h-auto">
            {getProviderValue(integration.integrationProvider, 18)}
          </div>
        }
      />
      <CommonField
        name={"Integration Type"}
        value={integration.integrationType}
      />
      {Object.entries(integration.configuration || {}).map(([k, v]) => {
        const value =
          k === "aws_integration_id" && typeof v === "string" ? (
            <LinkedIntegration id={v} />
          ) : k === "gcp_wif_pool_provider_audience" ||
            k === "gcp_wif_service_account_impersonation_url" ? (
            <div className="font-mono wrap-anywhere [word-break:break-word] text-fg-muted">
              {String(v)}
            </div>
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
    </BaseCard>
  );
};
