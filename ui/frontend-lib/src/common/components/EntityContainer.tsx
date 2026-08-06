import { ReactNode } from "react";

import { useLocation, useNavigate } from "react-router";

import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Box,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from "@mui/material";

import { NotFoundPage } from "../../dashboard/pages/NotFound";
import { useConfig } from "../context/ConfigContext";
import { useEntityProvider } from "../context/EntityContext";
import PageContainer from "../PageContainer";

import EntityActions from "./EntityActions";

export interface EntityContainerProps {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
  showEditAction?: boolean;
}

export const EntityContainer = (props: EntityContainerProps) => {
  const { children, title, actions, showEditAction } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();
  const { entity, loading, error, notFound, refreshEntity } =
    useEntityProvider();

  const handleRefresh = () => {
    if (refreshEntity) {
      refreshEntity();
    }
  };

  const handleBack = (fallback: string) => {
    // React Router uses the default key for direct-entry loads, which do not
    // have an in-app history entry to return to.
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  if (loading) {
    return (
      <PageContainer
        title="Loading..."
        onBack={() => handleBack(`${linkPrefix}${entity?.entityName}s`)}
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

  if (notFound) {
    return <NotFoundPage />;
  }

  if (error) {
    return (
      <PageContainer
        title="Error"
        onBack={() => handleBack(`${linkPrefix}${entity?.entityName}s`)}
      >
        <Alert severity="error" sx={{ width: "100%" }}>
          {error}
        </Alert>
      </PageContainer>
    );
  }

  if (!entity) {
    return (
      <PageContainer
        title="Not Found"
        onBack={() => handleBack(`${linkPrefix}`)}
      >
        <Alert severity="warning" sx={{ width: "100%" }}>
          Entity not found
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={title || entity?.name || entity?.identifier || "Entity"}
      onBack={() => handleBack(`${linkPrefix}${entity.entityName}s`)}
      actions={
        <>
          <EntityActions
            entity_id={entity.id}
            entity_name={entity.entityName}
            showEditAction={showEditAction}
          />
          {actions}
          <Tooltip title="Refresh">
            <IconButton onClick={() => handleRefresh()} aria-label="refresh">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </>
      }
    >
      {children}
    </PageContainer>
  );
};
