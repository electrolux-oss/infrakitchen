import { ReactNode } from "react";

import { NotFoundPage } from "../../../dashboard/pages/NotFound";
import { Alert, Spinner } from "../../../ui";
import { useEntityProvider } from "../../context/EntityContext";
import PageContainer from "../../PageContainer";
import EntityActions from "../entities/EntityActions";
import { EntityStatusChip } from "../labels/EntityStatusChip";

export interface EntityContainerProps {
  children: ReactNode;
  title?: string;
  /** Page-level notice rendered above the page header. */
  banner?: ReactNode;
  actions?: ReactNode;
  /** Label/content rendered inline next to the title. Defaults to the
   * entity's status chip (+ pending-changes marker) whenever the entity has
   * a status; pass a custom node to replace it, or `null` to hide it. */
  titleAdornment?: ReactNode;
  /** Icon shown before the title, usually the entity's menu icon. */
  titleIcon?: ReactNode;
  showEditAction?: boolean;
}

export const EntityContainer = (props: EntityContainerProps) => {
  const {
    children,
    title,
    banner,
    actions,
    titleAdornment,
    titleIcon,
    showEditAction,
  } = props;
  const { entity, loading, error, notFound } = useEntityProvider();

  // Status chip by default on every entity page that has a status; pages
  // override with their own titleAdornment (or pass null to opt out).
  const resolvedTitleAdornment =
    titleAdornment !== undefined ? (
      titleAdornment
    ) : entity?.status ? (
      <EntityStatusChip status={entity.status} state={entity.state} />
    ) : null;

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
      title={
        titleIcon ? (
          <span className="inline-flex items-center gap-2.5">
            <span className="inline-flex shrink-0 text-fg-muted">
              {titleIcon}
            </span>
            {title || entity?.name || entity?.identifier || "Entity"}
          </span>
        ) : (
          title || entity?.name || entity?.identifier || "Entity"
        )
      }
      documentTitle={entity.name || entity.identifier || title}
      banner={banner}
      titleAdornment={resolvedTitleAdornment}
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
