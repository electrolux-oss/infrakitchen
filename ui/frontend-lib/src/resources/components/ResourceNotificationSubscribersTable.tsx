import { useMemo } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { GetEntityLink } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import { NOTIFICATION_SUBSCRIPTION_FIELD_MAP } from "../../notifications";

interface ResourceNotificationSubscribersTableProps {
  resourceId: string;
}

export const ResourceNotificationSubscribersTable = ({
  resourceId,
}: ResourceNotificationSubscribersTableProps) => {
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
          return <GetEntityLink {...user} name={user.identifier} />;
        },
      },
      {
        field: "createdAt",
        headerName: "Subscribed",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime
            date={params.value}
            sx={{ fontSize: "0.75rem", display: "flex" }}
          />
        ),
      },
    ],
    [],
  );

  return (
    <EntityFetchTable
      title="Resource Subscribers"
      entityName="subscription"
      columns={columns}
      defaultFilter={{
        entity_type: "resource",
        entity_id: resourceId,
      }}
      entityFieldMap={NOTIFICATION_SUBSCRIPTION_FIELD_MAP}
    />
  );
};
