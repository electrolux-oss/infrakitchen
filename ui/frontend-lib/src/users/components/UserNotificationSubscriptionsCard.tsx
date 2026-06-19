import { useMemo, useState } from "react";

import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Button, Stack } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  DELETE_SUBSCRIPTION_MUTATION,
  NOTIFICATION_SUBSCRIPTION_FIELD_MAP,
} from "../../notifications";

const DeleteSubscriptionButton = ({ id }: { id: string }) => {
  const { ikApi } = useConfig();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await ikApi.graphqlRequest(DELETE_SUBSCRIPTION_MUTATION, { id });
      notify(
        "Subscription deleted. Use Refresh to update the list.",
        "success",
      );
      setIsConfirming(false);
    } catch (error) {
      notifyError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConfirming) {
    return (
      <Button
        variant="outlined"
        color="error"
        size="small"
        startIcon={<DeleteOutlineIcon />}
        onClick={() => setIsConfirming(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <Stack direction="row" spacing={1}>
      <Button
        variant="outlined"
        color="success"
        size="small"
        startIcon={<CheckIcon />}
        onClick={handleDelete}
        disabled={isLoading}
      >
        Confirm
      </Button>
      <Button
        variant="outlined"
        color="inherit"
        size="small"
        startIcon={<CloseIcon />}
        onClick={() => setIsConfirming(false)}
        disabled={isLoading}
      >
        Cancel
      </Button>
    </Stack>
  );
};

export const UserNotificationSubscriptionsCard = (props: {
  user_id: string;
}) => {
  const { user_id } = props;

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
          <RelativeTime
            date={params.value}
            sx={{ fontSize: "0.75rem", display: "flex" }}
          />
        ),
      },
      {
        field: "id",
        headerName: "Delete",
        sortable: false,
        renderCell: (params: GridRenderCellParams) => (
          <DeleteSubscriptionButton id={params.value} />
        ),
      },
    ],
    [],
  );

  return (
    <OverviewCard>
      <EntityFetchTable
        title="User Subscriptions"
        entityName="subscription"
        columns={columns}
        defaultFilter={{ user_id }}
        entityFieldMap={NOTIFICATION_SUBSCRIPTION_FIELD_MAP}
      />
    </OverviewCard>
  );
};
