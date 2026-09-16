import { useMemo } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { NOTIFICATION_SUBSCRIPTION_FIELD_MAP } from "../../notifications";

interface ServiceNotificationSubscribersTableProps {
  serviceId: string;
}

export const ServiceNotificationSubscribersTable = ({
  serviceId,
}: ServiceNotificationSubscribersTableProps) => {
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
        width: RELATIVE_TIME_COLUMN_WIDTH,
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime date={params.value} sx={{ display: "flex" }} />
        ),
      },
    ],
    [],
  );

  return (
    <EntityFetchTable
      title="Service Subscribers"
      entityName="subscription"
      columns={columns}
      defaultFilter={{
        entity_type: "service",
        entity_id: serviceId,
      }}
      entityFieldMap={NOTIFICATION_SUBSCRIPTION_FIELD_MAP}
    />
  );
};
