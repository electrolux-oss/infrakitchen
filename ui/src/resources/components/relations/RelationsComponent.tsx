import { useEntityProvider } from "../../../common";
import PageContainer from "../../../common/PageContainer";
import { RefreshIcon } from "../../../icons/material";
import { Alert, IconButton } from "../../../ui";

import { KubernetesRelations } from "./kubernetes/KubernetesRelations";
import { MetadataComponent } from "./MetadataComponent";

export const RelationsComponent = () => {
  const { entity, loading, error, refreshEntity } = useEntityProvider();

  const handleRefresh = () => {
    if (refreshEntity) {
      refreshEntity();
    }
  };

  return (
    <PageContainer
      title={`Resource Metadata for ${entity?.name || entity?.identifier}`}
      actions={
        <>
          <IconButton
            size="small"
            onClick={() => handleRefresh()}
            aria-label="refresh"
          >
            <RefreshIcon />
          </IconButton>
        </>
      }
    >
      {loading && <p className="m-0 text-body2">Loading...</p>}
      {error && (
        <Alert className="w-full" severity="error">
          {error}
        </Alert>
      )}
      {entity?.template?.cloudResourceTypes?.includes("aws_eks") ? (
        <KubernetesRelations entity={entity} />
      ) : (
        <>
          {entity?.template?.cloudResourceTypes?.length > 0 ? (
            <MetadataComponent entity={entity} />
          ) : (
            <Alert severity="info">
              <p className="m-0 text-h5">No relations available</p>
              <p className="m-0 text-body1">
                This entity does not have Any relations.
              </p>
            </Alert>
          )}
        </>
      )}
    </PageContainer>
  );
};
