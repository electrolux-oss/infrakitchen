import { useEffect, useState } from "react";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import { CommonField } from "../../common/components/CommonField";
import { useConfig } from "../../common/context/ConfigContext";
import { notify } from "../../common/hooks/useNotification";
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
    await navigator.clipboard.writeText(value);
    notify("Copied to clipboard", "success");
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
    <Stack direction="row" alignItems="center" spacing={1}>
      <Box
        component="span"
        sx={{ wordBreak: "break-all", fontFamily: "monospace" }}
      >
        {value}
      </Box>
      <Tooltip title="Copy">
        <IconButton size="small" onClick={() => handleCopy(value)}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
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
          <Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadJwks}
            >
              Download JWKS
            </Button>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.5 }}
            >
              Upload this JWKS into the GCP Workload Identity provider only when
              InfraKitchen is not publicly reachable by GCP.
            </Typography>
          </Box>
        }
      />
    </>
  );
};
