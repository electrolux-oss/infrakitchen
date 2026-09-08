import { useMemo } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { NOTIFICATION_SUBSCRIPTION_FIELD_MAP } from "../../notifications";

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
        renderCell: (params: GridRenderCellParams) => {
          const user = params.row.user;
          if (!user) return "Unknown";
          return <Entity entity={{ ...user, entityType: "user" }} />;
        },
      },
      {
        field: "createdAt",
        headerName: "Subscribed",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime date={params.value} sx={{ display: "flex" }} />
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
