import { useNavigate } from "react-router";

import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert, IconButton, Typography } from "@mui/material";

import { useEntityProvider } from "../../../common";
import { useConfig } from "../../../common/context/ConfigContext";
import PageContainer from "../../../common/PageContainer";

import { KubernetesRelations } from "./kubernetes/KubernetesRelations";
import { MetadataComponent } from "./MetadataComponent";

export const RelationsComponent = () => {
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();
  const { entity, loading, error, refreshEntity } = useEntityProvider();

  return (
    <PageContainer
      title={`Resource Metadata for ${entity?.name || entity?.identifier}`}
      onBack={() => navigate(`${linkPrefix}resources/${entity?.id}`)}
      actions={
        <>
          <IconButton onClick={refreshEntity} aria-label="refresh">
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
      {entity?.template?.cloud_resource_types?.includes("aws_eks") ? (
        <KubernetesRelations entity={entity} />
      ) : (
        <>
          {entity?.template?.cloud_resource_types?.length > 0 ? (
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
