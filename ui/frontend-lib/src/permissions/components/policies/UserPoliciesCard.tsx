import { useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import {
  GetEntityLink,
  GetReferenceUrlValue,
} from "../../../common/components/CommonField";
import { EntityFetchTable } from "../../../common/components/EntityFetchTable";
import { OverviewCard } from "../../../common/components/OverviewCard";
import { RelativeTime } from "../../../common/components/RelativeTime";
import { DeletePermissionButton } from "../PermissionActionButton";

import { EntityPolicyUserCreateDialog } from "./EntityPoliciesDialogs";

export const UserPoliciesCard = (props: { user_id: string }) => {
  const { user_id } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const columns = useMemo(
    () => [
      {
        field: "resource_name",
        fetchFields: ["resource_name", "resource_id"],
        headerName: "Resource Name",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <GetEntityLink
              id={params.row.resource_id}
              _entity_name={"resource"}
              name={params.row.resource_name}
            />
          );
        },
      },
      {
        field: "action",
        fetchFields: ["action", "v2"],
        headerName: "Action",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          if (params.row.action) {
            return params.row.action;
          } else {
            return params.row.v2;
          }
        },
      },
      {
        field: "created_at",
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
        field: "creator",
        headerName: "Creator",
        sortable: false,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          return creator ? <GetReferenceUrlValue {...creator} /> : "No User";
        },
      },
      {
        field: "id",
        headerName: "Delete",
        sortable: false,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <PermissionWrapper
            requiredPermission="api:permission"
            permissionAction="admin"
          >
            <DeletePermissionButton permission_id={params.value} />
          </PermissionWrapper>
        ),
      },
    ],
    [],
  );

  return (
    <OverviewCard name="User Policies">
      <PermissionWrapper
        requiredPermission="api:permission"
        permissionAction="write"
      >
        <Button
          variant="outlined"
          onClick={() => handleOpenDialog()}
          startIcon={<Icon icon="icon-park-outline:add" />}
        >
          Add Resource Policy
        </Button>
        <EntityPolicyUserCreateDialog
          user_id={user_id}
          open={isDialogOpen}
          onClose={handleCloseDialog}
        />
      </PermissionWrapper>
      <EntityFetchTable
        title="User Policies"
        entityName={`resources/permissions/user/${user_id}/policie`}
        columns={columns}
        defaultFilter={{ policy_type: "resource" }}
        fields={["id"]}
      />
    </OverviewCard>
  );
};
