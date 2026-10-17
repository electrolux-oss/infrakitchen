import { ReactNode } from "react";

import { NotFoundPage } from "../../../dashboard/pages/NotFound";
import { Alert, Spinner } from "../../../ui";
import { useEntityProvider } from "../../context/EntityContext";
import PageContainer from "../../PageContainer";
import EntityActions from "../entities/EntityActions";

export interface EntityContainerProps {
  children: ReactNode;
  title?: string;
  /** Page-level notice rendered above the page header. */
  banner?: ReactNode;
  actions?: ReactNode;
  showEditAction?: boolean;
}

export const EntityContainer = (props: EntityContainerProps) => {
  const { children, title, banner, actions, showEditAction } = props;
  const { entity, loading, error, notFound } = useEntityProvider();

  if (loading) {
    return (
      <PageContainer title="Loading...">
        <div className="flex h-75 items-center justify-center">
          <Spinner />
        </div>
      </PageContainer>
    );
  }

  if (notFound) {
    return <NotFoundPage />;
  }

  if (error) {
    return (
      <PageContainer title="Error">
        <Alert className="w-full" severity="error">
          {error}
        </Alert>
      </PageContainer>
    );
  }

  if (!entity) {
    return (
      <PageContainer title="Not Found">
        <Alert className="w-full" severity="warning">
          Entity not found
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={title || entity?.name || entity?.identifier || "Entity"}
      documentTitle={entity.name || entity.identifier || title}
      banner={banner}
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
