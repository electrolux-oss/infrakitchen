import { useState, useEffect } from "react";

import { json } from "@codemirror/lang-json";
import { Alert, Box } from "@mui/material";
import CodeMirror from "@uiw/react-codemirror";

import { useConfig, GradientCircularProgress } from "../../../common";
import { notifyError } from "../../../common/hooks/useNotification";
import { ResourceResponse } from "../../types";

export interface ResourceMetadataProps {
  entity: ResourceResponse;
}

export function MetadataComponent(props: ResourceMetadataProps) {
  const { entity } = props;

  const { ikApi } = useConfig();
  const [metadata, setMetadata] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    ikApi
      .get(`resources/${entity.id}/metadata`)
      .then((response: any) => {
        setMetadata(response);
      })
      .catch((err: { message: string }) => {
        notifyError(err);
        setError(new Error(err.message));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ikApi, entity]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <GradientCircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error.toString()}</Alert>
      </Box>
    );
  }

  if (!metadata) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          No metadata information found for resource {entity.name}.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: "100%", overflow: "auto" }}>
      <CodeMirror
        value={JSON.stringify(metadata, null, 2)}
        extensions={[json()]}
        readOnly={true}
        style={{
          border: "1px solid silver",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      />
    </Box>
  );
}
