import { useMemo, useRef, useState } from "react";

import { useConfig } from "../../common";
import { deleteIconButtonClass } from "../../common/components/buttons/deleteIconButtonClass";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { Entity } from "../../common/components/entities/Entity";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../common/components/entity_table/EntityFetchTable";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { notifyError } from "../../common/hooks/useNotification";
import { DeleteOutlinedIcon } from "../../icons/material";
import {
  DELETE_SUBSCRIPTION_MUTATION,
  NOTIFICATION_SUBSCRIPTION_FIELD_MAP,
} from "../../notifications";
import { IconButton } from "../../ui";
import { RenderCellParams } from "../../ui";

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
      className={deleteIconButtonClass}
    >
      <DeleteOutlinedIcon fontSize="small" />
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
        renderCell: (params: RenderCellParams) => {
          return (
            <Entity
              entity={{
                ...params.row.entityData,
                id: params.row.entityData?.id,
                entityType: params.row.entityData?.entityName,
                name: params.row.entityData?.name || params.row.v1,
              }}
              showLifecycleState={false}
            />
          );
        },
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        renderCell: (params: RenderCellParams) => (
          <RelativeTime
            className="flex justify-end"
            date={params.value}
            compact
          />
        ),
      },
      {
        field: "id",
        headerName: "Delete",
        sortable: false,
        renderCell: (params: RenderCellParams) => (
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
    <BaseCard
      name="Subscriptions"
      description="Entities you follow. You receive their notifications in-app; add a preference above to also get them in Slack."
    >
      <div className="col-span-full">
        <EntityFetchTable
          ref={tableRef}
          title="User Subscriptions"
          entityName="subscription"
          columns={columns}
          defaultFilter={{ user_id }}
          entityFieldMap={NOTIFICATION_SUBSCRIPTION_FIELD_MAP}
        />
      </div>
    </BaseCard>
  );
};
