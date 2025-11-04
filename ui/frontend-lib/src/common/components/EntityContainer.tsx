import { ReactNode } from "react";

import { useNavigate } from "react-router";

import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, CircularProgress, Alert, IconButton } from "@mui/material";

import { useConfig } from "../context/ConfigContext";
import { useEntityProvider } from "../context/EntityContext";
import PageContainer from "../PageContainer";

import EntityActions from "./EntityActions";

export interface EntityContainerProps {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
}

export const EntityContainer = (props: EntityContainerProps) => {
  const { children, title, actions } = props;
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();
  const { entity, loading, error, refreshEntity } = useEntityProvider();

  if (loading) {
    return (
      <PageContainer
        title="Loading..."
        onBack={() => navigate(`${linkPrefix}${entity?._entity_name}s`)}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 300,
          }}
        >
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer
        title="Error"
        onBack={() => navigate(`${linkPrefix}${entity?._entity_name}s`)}
      >
        <Alert severity="error" sx={{ width: "100%" }}>
          {error}
        </Alert>
      </PageContainer>
    );
  }

  if (!entity) {
    return (
      <PageContainer title="Not Found" onBack={() => navigate(`${linkPrefix}`)}>
        <Alert severity="warning" sx={{ width: "100%" }}>
          Entity not found
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={title || entity?.name || entity?.identifier || "Entity"}
      onBack={() => navigate(`${linkPrefix}${entity._entity_name}s`)}
      actions={
        <>
          <EntityActions
            entity_id={entity.id}
            entity_name={entity._entity_name}
          />
          {actions}
          <IconButton onClick={refreshEntity} aria-label="refresh">
            <RefreshIcon />
          </IconButton>
        </>
      }
    >
      {children}
    </PageContainer>
  );
};
