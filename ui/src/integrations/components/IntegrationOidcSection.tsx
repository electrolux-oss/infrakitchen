import { useEffect, useState } from "react";

import { CommonField } from "../../common/components/fields/CommonField";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { copyToClipboard } from "../../common/utils/clipboard";
import { ContentCopyIcon, DownloadIcon } from "../../icons/material";
import { Button, IconButton, Tooltip } from "../../ui";
import { INTEGRATION_OIDC_QUERY } from "../graphql/queries";

interface IntegrationOidcDetails {
  issuerUrl: string;
  jwksUrl: string;
  audience: string | null;
  jwksFilename: string;
  jwksContentBase64: string;
}

export interface IntegrationOidcSectionProps {
  integrationId: string;
}

/**
 * Shows the InfraKitchen-issued OIDC provider details for a GCP Workload Identity Federation
 * integration: the issuer URL to configure in GCP, and a JWKS download for the offline case
 * (when InfraKitchen is not publicly reachable by GCP).
 */
export const IntegrationOidcSection = ({
  integrationId,
}: IntegrationOidcSectionProps) => {
  const { ikApi } = useConfig();
  const [details, setDetails] = useState<IntegrationOidcDetails | null>(null);

  useEffect(() => {
    let active = true;
    ikApi
      .graphqlRequest<{ integrationOidc: IntegrationOidcDetails }>(
        INTEGRATION_OIDC_QUERY,
        { id: integrationId },
      )
      .then((response) => {
        if (active) setDetails(response.integrationOidc);
      })
      .catch(() => {
        // Not an OIDC integration (or not reachable) – render nothing.
        if (active) setDetails(null);
      });
    return () => {
      active = false;
    };
  }, [ikApi, integrationId]);

  if (!details) return null;

  const handleCopy = async (value: string) => {
    try {
      await copyToClipboard(value);
      notify("Copied to clipboard", "success");
    } catch (error) {
      notifyError(error);
    }
  };

  const handleDownloadJwks = () => {
    const bytes = Uint8Array.from(atob(details.jwksContentBase64), (char) =>
      char.charCodeAt(0),
    );
    const blob = new Blob([bytes], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = details.jwksFilename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyableValue = (value: string) => (
    <div className="flex flex-row items-center gap-2">
      <span className="font-mono break-all">{value}</span>
      <Tooltip title="Copy">
        <IconButton size="small" onClick={() => handleCopy(value)}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </div>
  );

  return (
    <>
      <CommonField
        name={"OIDC Issuer URL"}
        value={copyableValue(details.issuerUrl)}
      />
      <CommonField
        name={"OIDC JWKS URL"}
        value={copyableValue(details.jwksUrl)}
      />
      <CommonField
        name={"OIDC JWKS (offline upload)"}
        value={
          <div>
            <Button startIcon={<DownloadIcon />} onClick={handleDownloadJwks}>
              Download JWKS
            </Button>
            <span className="mt-1 block text-caption text-fg-muted">
              Upload this JWKS into the GCP Workload Identity provider only when
              InfraKitchen is not publicly reachable by GCP.
            </span>
          </div>
        }
      />
    </>
  );
};
