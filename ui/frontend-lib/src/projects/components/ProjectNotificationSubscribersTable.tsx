import { useMemo } from "react";

import { Entity } from "../../common/components/entities/Entity";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { NOTIFICATION_SUBSCRIPTION_FIELD_MAP } from "../../notifications";
import { RenderCellParams } from "../../ui";

interface ProjectNotificationSubscribersTableProps {
  projectId: string;
}

export const ProjectNotificationSubscribersTable = ({
  projectId,
}: ProjectNotificationSubscribersTableProps) => {
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
    ],
    [],
  );

  return (
    <EntityFetchTable
      title="Project Subscribers"
      entityName="subscription"
      columns={columns}
      defaultFilter={{
        entity_type: "project",
        entity_id: projectId,
      }}
      entityFieldMap={NOTIFICATION_SUBSCRIPTION_FIELD_MAP}
    />
  );
};
