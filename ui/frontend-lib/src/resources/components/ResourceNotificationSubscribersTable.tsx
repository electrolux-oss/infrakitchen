import { useMemo } from "react";

import { useNavigate } from "react-router";

import { Chip } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { GetEntityLink } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { NOTIFICATION_SUBSCRIPTION_FIELD_MAP } from "../../notifications";

interface ResourceNotificationSubscribersTableProps {
  resourceId: string;
  projectId?: string;
}

export const ResourceNotificationSubscribersTable = ({
  resourceId,
  projectId,
}: ResourceNotificationSubscribersTableProps) => {
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

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
      ...(projectId
        ? [
            {
              field: "subscriptionSource",
              fetchFields: ["entityType"],
              headerName: "Source",
              sortable: false,
              flex: 1,
              renderCell: (params: GridRenderCellParams) => {
                const isInherited = params.row.entityType === "project";
                const projectNotificationsPath = `${linkPrefix}projects/${projectId}/notifications`;

                return isInherited ? (
                  <Chip
                    label="Inherited from Project"
                    color="info"
                    variant="outlined"
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
                  <Chip label="Direct" variant="outlined" />
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
      title="Resource Subscribers"
      entityName="subscription"
      columns={columns}
      defaultFilter={
        projectId
          ? {
              entity_id__in: [resourceId, projectId],
            }
          : {
              entity_type: "resource",
              entity_id: resourceId,
            }
      }
      entityFieldMap={NOTIFICATION_SUBSCRIPTION_FIELD_MAP}
    />
  );
};
