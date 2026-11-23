import { useMemo } from "react";

import { useNavigate } from "react-router";

import { Entity } from "../../common/components/entities/Entity";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { Label } from "../../common/components/labels";
import { useConfig } from "../../common/context";
import { RenderCellParams } from "../../ui";
import { NOTIFICATION_SUBSCRIPTION_FIELD_MAP } from "../graphql";

export interface EntityNotificationSubscribersTableProps {
  /** Subscription entity type, e.g. "resource" or "executor". */
  entityType: string;
  entityId: string;
  /** Project the entity belongs to: its subscribers are listed as inherited. */
  projectId?: string;
  title: string;
}

/**
 * Users subscribed to an entity, plus the subscribers of its project, who get
 * the entity's notifications too.
 */
export const EntityNotificationSubscribersTable = ({
  entityType,
  entityId,
  projectId,
  title,
}: EntityNotificationSubscribersTableProps) => {
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

  const columns = useMemo(
    () => [
      {
        field: "user",
        headerName: "User",
        flex: 1,
        sortField: "user.identifier",
        renderCell: (params: RenderCellParams) => {
          const user = params.row.user;
          if (!user) return "Unknown";
          return <Entity entity={{ ...user, entityType: "user" }} />;
        },
      },
      {
        field: "createdAt",
        headerName: "Subscribed",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        renderCell: (params: RenderCellParams) => (
          <RelativeTime
            className="flex justify-end"
            date={params.value}
            compact
          />
        ),
      },
      ...(projectId
        ? [
            {
              field: "subscriptionSource",
              fetchFields: ["entityType"],
              headerName: "Source",
              sortable: false,
              flex: 1,
              renderCell: (params: RenderCellParams) => {
                const isInherited = params.row.entityType === "project";
                const projectNotificationsPath = `${linkPrefix}projects/${projectId}/notifications`;

                return isInherited ? (
                  <Label
                    label="Inherited from Project"
                    tone="info"
                    component="a"
                    href={projectNotificationsPath}
                    clickable
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey) {
                        return;
                      }

                      event.preventDefault();
                      navigate(projectNotificationsPath);
                    }}
                  />
                ) : (
                  <Label label="Direct" />
                );
              },
            },
          ]
        : []),
    ],
    [linkPrefix, navigate, projectId],
  );

  return (
    <EntityFetchTable
      title={title}
      entityName="subscription"
      columns={columns}
      defaultFilter={
        projectId
          ? {
              entity_id__in: [entityId, projectId],
            }
          : {
              entity_type: entityType,
              entity_id: entityId,
            }
      }
      entityFieldMap={NOTIFICATION_SUBSCRIPTION_FIELD_MAP}
    />
  );
};
