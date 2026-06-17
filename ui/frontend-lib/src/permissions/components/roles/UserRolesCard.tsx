import { useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import { GetEntityLink } from "../../../common/components/CommonField";
import { EntityFetchTable } from "../../../common/components/EntityFetchTable";
import { OverviewCard } from "../../../common/components/OverviewCard";
import { RelativeTime } from "../../../common/components/RelativeTime";
import { PERMISSION_FIELD_MAP, transformPermission } from "../../graphql";
import { DeletePermissionButton } from "../PermissionActionButton";

import { UserRoleCreateDialog } from "./AssignUserToRoleDialog";

export const UserRolesCard = (props: { userId: string }) => {
  const { userId } = props;
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
        field: "v1",
        headerName: "Role Name",
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <GetEntityLink
              name={params.row.v1}
              id={params.row.v1}
              _entity_name={"role"}
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
        field: "creator",
        headerName: "Creator",
        flex: 1,
        sortField: "creator.identifier",
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          if (!creator) return null;
          return <GetEntityLink {...creator} name={creator.identifier} />;
        },
      },
      {
        field: "id",
        headerName: "Delete",
        sortable: false,
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
    <OverviewCard>
      <PermissionWrapper
        requiredPermission="api:permission"
        permissionAction="write"
      >
        <Button
          variant="outlined"
          onClick={() => handleOpenDialog()}
          startIcon={<Icon icon="icon-park-outline:add" />}
        >
          Add Role
        </Button>

        <UserRoleCreateDialog
          userId={userId}
          open={isDialogOpen}
          onClose={handleCloseDialog}
        />
      </PermissionWrapper>

      <EntityFetchTable
        title="User Roles"
        entityName="permission"
        columns={columns}
        defaultFilter={{ ptype: "g", v0: `user:${userId}` }}
        entityFieldMap={PERMISSION_FIELD_MAP}
        transformFn={transformPermission}
      />
    </OverviewCard>
  );
};
