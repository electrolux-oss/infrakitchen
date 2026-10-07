import { useState } from "react";

import BugReportIcon from "@mui/icons-material/BugReport";
import { IconButton, Tooltip } from "@mui/material";

import { RESOURCE_DOWNLOAD_QUERY } from "../../../resources/graphql/queries";
import { useConfig } from "../../context/ConfigContext";
import { notifyError } from "../../hooks/useNotification";

export const DownloadSourceCodeButton = ({
  entityId,
}: {
  entityId: string;
}) => {
  const { ikApi } = useConfig();
  const [isLoading, setIsLoading] = useState(false);

  const handleDownloadClick = async () => {
    if (!entityId) return;
    setIsLoading(true);

    await ikApi
      .graphqlRequest<{
        resourceDownload: {
          filename: string;
          contentType: string;
          contentBase64: string;
        };
      }>(RESOURCE_DOWNLOAD_QUERY, { id: entityId })
      .then((response) => {
        const bytes = Uint8Array.from(
          atob(response.resourceDownload.contentBase64),
          (char) => char.charCodeAt(0),
        );
        const blob = new Blob([bytes], {
          type: response.resourceDownload.contentType,
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = response.resourceDownload.filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => {
        notifyError(e);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <Tooltip title="Download source code for debugging">
      <IconButton
        onClick={() => handleDownloadClick()}
        disabled={isLoading}
        aria-label="Download source code for debugging"
      >
        <BugReportIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};
