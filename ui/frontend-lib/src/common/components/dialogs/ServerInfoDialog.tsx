import { InfrakitchenLogo } from "../../../icons/InfrakitchenLogo";
import { LaunchIcon } from "../../../icons/material";
import {
  Alert,
  Divider,
  Spinner,
  Dialog,
  DialogContent,
  DialogTitle,
  Link,
} from "../../../ui";
import { useConfig } from "../../context/ConfigContext";

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
    <div className="flex flex-row items-start gap-4">
      <p className="m-0 min-w-30 shrink-0 text-body2 text-fg-muted">{label}</p>
      {url ? (
        <Link
          className="inline-flex items-center gap-1 font-mono [word-break:break-word]"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          {displayValue}
          <LaunchIcon className="text-[14px]" />
        </Link>
      ) : (
        <p className="m-0 font-mono text-body2 [word-break:break-word]">
          {displayValue}
        </p>
      )}
    </div>
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
    <div className="flex flex-row items-start gap-4">
      <p className="m-0 min-w-30 shrink-0 text-body2 text-fg-muted">
        Host info
      </p>
      <p className="m-0 font-mono text-body2 whitespace-pre-wrap">
        {`${platform} (${arch})\n${formattedString}`}
      </p>
    </div>
  );
};

export const ServerInfoDialog = ({ open, onClose }: ServerInfoDialogProps) => {
  const { serverInfo, serverInfoLoading, serverInfoError } = useConfig();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <div className="flex flex-row items-center gap-3">
          <div className="flex items-center [&_svg]:mr-0 [&_svg]:h-7 [&_svg]:w-7">
            <InfrakitchenLogo />
          </div>
          <span className="text-h6">About InfraKitchen</span>
        </div>
      </DialogTitle>
      <DialogContent dividers>
        <div className="flex flex-col gap-5">
          {serverInfoLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size={24} />
            </div>
          ) : serverInfoError ? (
            <Alert severity="error">{serverInfoError}</Alert>
          ) : serverInfo ? (
            <>
              {/* Release identification: what build is running. */}
              <div>
                <h6 className="m-0 mb-2 text-[0.75rem] font-semibold tracking-[0.08em] text-fg-muted uppercase">
                  Build
                </h6>
                <div className="flex flex-col gap-2">
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
                </div>
              </div>

              <Divider />

              {/* Runtime environment: where the server runs. */}
              <div>
                <h6 className="m-0 mb-2 text-[0.75rem] font-semibold tracking-[0.08em] text-fg-muted uppercase">
                  Server
                </h6>
                <div className="flex flex-col gap-2">
                  <InfoRow label="Python" value={serverInfo.python} />
                  <HostInfoRow hostMetadata={serverInfo.hostMetadata} />
                </div>
              </div>
            </>
          ) : (
            <p className="m-0 text-body2 text-fg-muted">
              No server info available.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
