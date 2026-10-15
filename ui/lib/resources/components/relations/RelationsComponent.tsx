import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert, IconButton, Typography } from "@mui/material";

import { useEntityProvider } from "../../../common";
import PageContainer from "../../../common/PageContainer";

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
      {loading && <Typography>Loading...</Typography>}
      {error && (
        <Alert severity="error" sx={{ width: "100%" }}>
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
              <Typography variant="h5" component="p">
                No relations available
              </Typography>
              <Typography variant="body1">
                This entity does not have Any relations.
              </Typography>
            </Alert>
          )}
        </>
      )}
    </PageContainer>
  );
};
