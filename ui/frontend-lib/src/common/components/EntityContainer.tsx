import { ReactNode } from "react";

import { Alert, Box, CircularProgress } from "@mui/material";

import { NotFoundPage } from "../../dashboard/pages/NotFound";
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
  const { entity, loading, error, notFound } = useEntityProvider();

  if (loading) {
    return (
      <PageContainer title="Loading...">
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
      <PageContainer title="Error">
        <Alert severity="error" sx={{ width: "100%" }}>
          {error}
        </Alert>
      </PageContainer>
    );
  }

  if (!entity) {
    return (
      <PageContainer title="Not Found">
        <Alert severity="warning" sx={{ width: "100%" }}>
          Entity not found
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={title || entity?.name || entity?.identifier || "Entity"}
      actions={
        <>
          <EntityActions
            entity_id={entity.id}
            entity_name={entity.entityName}
            showEditAction={showEditAction}
          />
          {actions}
        </>
      }
    >
      {children}
    </PageContainer>
  );
};
