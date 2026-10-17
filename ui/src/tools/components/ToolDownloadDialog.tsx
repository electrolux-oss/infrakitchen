import { useEffect, useState } from "react";

import { useConfig } from "../../common";
import { CommonDialog } from "../../common/components/dialogs";
import { notifyError } from "../../common/hooks/useNotification";
import { ProviderIcon } from "../../icons/Icons";
import { DownloadIcon } from "../../icons/material";
import {
  Checkbox,
  FormControlLabel,
  Button,
  MenuItem,
  TextField,
} from "../../ui";
import { AVAILABLE_TOOL_VERSIONS_QUERY } from "../graphql";
import {
  TOOL_ARCH_OPTIONS,
  TOOL_NAMES,
  TOOL_OS_OPTIONS,
  ToolName,
} from "../types";

const SERVER_DEFAULT = "server_default";

export interface ToolDownloadInput {
  name: string;
  version: string;
  os?: string | null;
  arch?: string | null;
}

interface ToolDownloadDialogProps {
  open: boolean;
  onClose: () => void;
  /** Resolves true when the download was requested. */
  onDownload: (input: ToolDownloadInput) => Promise<boolean>;
  downloading: boolean;
}

export const ToolDownloadDialog = ({
  open,
  onClose,
  onDownload,
  downloading,
}: ToolDownloadDialogProps) => {
  const { ikApi } = useConfig();

  const [name, setName] = useState<ToolName>("opentofu");
  const [includePrerelease, setIncludePrerelease] = useState(false);
  const [versions, setVersions] = useState<string[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [version, setVersion] = useState("");
  // Select renders an empty value as blank, so the server default needs its own value
  const [os, setOs] = useState(SERVER_DEFAULT);
  const [arch, setArch] = useState(SERVER_DEFAULT);

  useEffect(() => {
    if (!open) {
      return;
    }
    setVersion("");
    setVersionsLoading(true);
    ikApi
      .graphqlRequest<{ availableToolVersions: string[] }>(
        AVAILABLE_TOOL_VERSIONS_QUERY,
        { name, includePrerelease },
      )
      .then((response) => setVersions(response.availableToolVersions))
      .catch((error: any) => {
        setVersions([]);
        notifyError(error);
      })
      .finally(() => setVersionsLoading(false));
  }, [ikApi, open, name, includePrerelease]);

  const handleDownload = async () => {
    if (!version) {
      return;
    }
    if (
      await onDownload({
        name,
        version,
        os: os === SERVER_DEFAULT ? null : os,
        arch: arch === SERVER_DEFAULT ? null : arch,
      })
    ) {
      setVersion("");
      onClose();
    }
  };

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Add tool"
      content={
        <div
          // the outlined labels float above the first row, so the top needs more room to match the bottom
          className="flex flex-col gap-4 pt-6 pb-2"
        >
          <div className="flex flex-col gap-4 sm:flex-row">
            <TextField
              select
              fullWidth
              label="Tool"
              value={name}
              onChange={(event) => setName(event.target.value as ToolName)}
            >
              {TOOL_NAMES.map((item) => (
                <MenuItem key={item.value} value={item.value} className="gap-2">
                  <ProviderIcon provider={item.value} />
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <TextField
              select
              fullWidth
              label="Operating system"
              value={os}
              onChange={(event) => setOs(event.target.value)}
            >
              <MenuItem value={SERVER_DEFAULT}>Server default</MenuItem>
              {TOOL_OS_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="Architecture"
              value={arch}
              onChange={(event) => setArch(event.target.value)}
            >
              <MenuItem value={SERVER_DEFAULT}>Server default</MenuItem>
              {TOOL_ARCH_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </div>
          <div>
            <TextField
              select
              fullWidth
              label="Version"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              disabled={versionsLoading || versions.length === 0}
              helperText={
                versionsLoading
                  ? "Loading versions…"
                  : `${versions.length} versions available`
              }
            >
              {versions.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              className="mt-1"
              control={
                <Checkbox
                  size="small"
                  checked={includePrerelease}
                  onChange={(event) =>
                    setIncludePrerelease(event.target.checked)
                  }
                />
              }
              label={<p className="m-0 text-body2">Include pre-releases</p>}
            />
          </div>
        </div>
      }
      actions={
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
          disabled={!version || downloading}
        >
          Download
        </Button>
      }
    />
  );
};
