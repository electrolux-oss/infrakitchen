import LaunchIcon from "@mui/icons-material/Launch";
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Stack,
  Typography,
} from "@mui/material";

import { InfrakitchenLogo } from "../../icons/InfrakitchenLogo";
import { CODE_FONT_FAMILY } from "../theme";
import { useConfig } from "../context/ConfigContext";

const flattenObject = (object: Record<string, unknown>) => {
  const result: Record<string, unknown> = {};
  for (const key in object) {
    if (typeof object[key] === "object" && object[key] !== null) {
      const flatObject = flattenObject(object[key] as Record<string, unknown>);
      for (const nestedKey in flatObject) {
        if (nestedKey) {
          result[`${key}_${nestedKey}`] = flatObject[nestedKey];
        }
      }
    } else {
      result[key] = object[key];
    }
  }
  return result;
};

export interface ServerInfoDialogProps {
  open: boolean;
  onClose: () => void;
}

const formatValue = (value: string) => {
  return value && value !== "unknown" ? value : "Unknown";
};

const InfoRow = ({
  label,
  value,
  url,
}: {
  label: string;
  value: string;
  url?: string;
}) => {
  const displayValue = formatValue(value);

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
      <Typography
        sx={{ color: "text.secondary", minWidth: 120, flexShrink: 0 }}
      >
        {label}
      </Typography>
      {url ? (
        <Link
          href={url}
          target="_blank"
          rel="noreferrer"
          underline="hover"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            fontFamily: CODE_FONT_FAMILY,
            wordBreak: "break-word",
          }}
        >
          {displayValue}
          <LaunchIcon sx={{ fontSize: 14 }} />
        </Link>
      ) : (
        <Typography
          sx={{ fontFamily: CODE_FONT_FAMILY, wordBreak: "break-word" }}
        >
          {displayValue}
        </Typography>
      )}
    </Stack>
  );
};

const HostInfoRow = ({
  hostMetadata,
}: {
  hostMetadata?: Record<string, string>;
}) => {
  if (!hostMetadata) {
    return <InfoRow label="Host info" value="unknown" />;
  }

  const metadata = flattenObject(hostMetadata);
  const platform = String(metadata.platform || "N/A");
  const arch = String(metadata.machine || "N/A");
  const formattedString = Object.entries(metadata)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
      <Typography
        sx={{ color: "text.secondary", minWidth: 120, flexShrink: 0 }}
      >
        Host info
      </Typography>
      <Typography
        sx={{ m: 0, whiteSpace: "pre-wrap", fontFamily: CODE_FONT_FAMILY }}
      >
        {`${platform} (${arch})\n${formattedString}`}
      </Typography>
    </Stack>
  );
};

export const ServerInfoDialog = ({ open, onClose }: ServerInfoDialogProps) => {
  const { serverInfo, serverInfoLoading, serverInfoError } = useConfig();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              "& svg": { width: 28, height: 28, mr: 0 },
            }}
          >
            <InfrakitchenLogo />
          </Box>
          <Typography component="span" variant="h6">
            About InfraKitchen
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {serverInfoLoading ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                py: 4,
              }}
            >
              <CircularProgress size={24} />
            </Box>
          ) : serverInfoError ? (
            <Alert severity="error">{serverInfoError}</Alert>
          ) : serverInfo ? (
            <>
              {/* Release identification: what build is running. */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 1,
                    color: "text.secondary",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Build
                </Typography>
                <Stack spacing={1}>
                  <InfoRow
                    label="Version"
                    value={serverInfo.version}
                    url={serverInfo.versionUrl}
                  />
                  <InfoRow
                    label="Repository"
                    value={serverInfo.repository}
                    url={serverInfo.repositoryUrl}
                  />
                  <InfoRow
                    label="Commit"
                    value={serverInfo.sourceCommitShort}
                    url={serverInfo.sourceUrl}
                  />
                </Stack>
              </Box>

              <Divider />

              {/* Runtime environment: where the server runs. */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 1,
                    color: "text.secondary",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Server
                </Typography>
                <Stack spacing={1}>
                  <InfoRow label="Python" value={serverInfo.python} />
                  <HostInfoRow hostMetadata={serverInfo.hostMetadata} />
                </Stack>
              </Box>
            </>
          ) : (
            <Typography color="textSecondary">
              No server info available.
            </Typography>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
