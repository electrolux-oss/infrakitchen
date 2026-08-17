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
        variant="body2"
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
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
        >
          {displayValue}
          <LaunchIcon sx={{ fontSize: 14 }} />
        </Link>
      ) : (
        <Typography variant="body2">{displayValue}</Typography>
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
        variant="body2"
        sx={{ color: "text.secondary", minWidth: 120, flexShrink: 0 }}
      >
        Host info
      </Typography>
      <Typography
        component="pre"
        variant="body2"
        sx={{ m: 0, whiteSpace: "pre-wrap" }}
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
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Build
            </Typography>
            <Stack spacing={1}>
              <InfoRow
                label="Version"
                value={serverInfo?.version || "unknown"}
                url={serverInfo?.versionUrl}
              />
              <InfoRow
                label="Commit"
                value={serverInfo?.sourceCommitShort || "unknown"}
                url={serverInfo?.sourceUrl}
              />
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Server
            </Typography>

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
                  label="Source commit"
                  value={serverInfo.sourceCommit}
                  url={serverInfo.sourceUrl}
                />
                <InfoRow label="Python" value={serverInfo.python} />
                <HostInfoRow hostMetadata={serverInfo.hostMetadata} />
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No server info available.
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
