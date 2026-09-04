import { useMemo, useRef, useState } from "react";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { IconButton } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import { BaseCard } from "../../common/components/BaseCard";
import { deleteIconButtonStyle } from "../../common/components/buttons/deleteIconButtonStyle";
import { GetEntityLink } from "../../common/components/CommonField";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../common/components/entity_table/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import { notifyError } from "../../common/hooks/useNotification";
import {
  DELETE_SUBSCRIPTION_MUTATION,
  NOTIFICATION_SUBSCRIPTION_FIELD_MAP,
} from "../../notifications";

const DeleteSubscriptionButton = ({
  id,
  onDeleted,
}: {
  id: string;
  onDeleted?: () => void;
}) => {
  const { ikApi } = useConfig();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await ikApi.graphqlRequest(DELETE_SUBSCRIPTION_MUTATION, { id });
      onDeleted?.();
    } catch (error) {
      notifyError(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <IconButton
      title="Delete Subscription"
      onClick={() => void handleDelete()}
      disabled={isLoading}
      size="small"
      sx={deleteIconButtonStyle}
    >
      <DeleteOutlineIcon fontSize="small" />
    </IconButton>
  );
};

export const UserNotificationSubscriptionsCard = (props: {
  user_id: string;
}) => {
  const { user_id } = props;
  const tableRef = useRef<EntityFetchTableRef>(null);

  const refreshSubscriptions = () => {
    void tableRef.current?.refresh();
  };

  const columns = useMemo(
    () => [
      {
        field: "entity",
        fetchFields: ["entityData"],
        headerName: "Entity",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <GetEntityLink
              id={params.row.entityData?.id}
              entityName={params.row.entityData?.entityName}
              name={params.row.entityData?.name || params.row.v1}
            />
          );
        },
      },
      {
        field: "createdAt",
        headerName: "Created",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime date={params.value} sx={{ display: "flex" }} />
        ),
      },
      {
        field: "id",
        headerName: "Delete",
        sortable: false,
        renderCell: (params: GridRenderCellParams) => (
          <DeleteSubscriptionButton
            id={params.value}
            onDeleted={refreshSubscriptions}
          />
        ),
      },
    ],
    [],
  );

  return (
    <BaseCard>
      <EntityFetchTable
        ref={tableRef}
        title="User Subscriptions"
        entityName="subscription"
        columns={columns}
        defaultFilter={{ user_id }}
        entityFieldMap={NOTIFICATION_SUBSCRIPTION_FIELD_MAP}
      />
    </BaseCard>
  );
};
