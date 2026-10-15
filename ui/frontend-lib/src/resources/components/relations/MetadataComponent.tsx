import { useState, useEffect } from "react";

import { json } from "@codemirror/lang-json";
import CodeMirror from "@uiw/react-codemirror";

import { useConfig, GradientCircularProgress } from "../../../common";
import { notifyError } from "../../../common/hooks/useNotification";
import { Alert } from "../../../ui";
import { GqlResource } from "../../graphql";
import { RESOURCE_METADATA_QUERY } from "../../graphql";

export interface ResourceMetadataProps {
  entity: GqlResource;
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
      .graphqlRequest(RESOURCE_METADATA_QUERY, { id: entity.id })
      .then((response) => {
        const typedResponse = response as { resourceMetadata: any };
        setMetadata(typedResponse.resourceMetadata);
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
      <div className="flex justify-center p-8">
        <GradientCircularProgress />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert severity="error">{error.toString()}</Alert>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="p-4">
        <Alert severity="info">
          No metadata information found for resource {entity.name}.
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <CodeMirror
        value={JSON.stringify(metadata, null, 2)}
        extensions={[json()]}
        readOnly={true}
        style={{
          border: "1px solid var(--color-divider)",
          borderRadius: "var(--ik-surface-radius)",
          overflow: "hidden",
        }}
      />
    </div>
  );
}
