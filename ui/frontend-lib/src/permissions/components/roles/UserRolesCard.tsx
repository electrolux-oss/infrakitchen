import { useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import {
  GetEntityLink,
  getDateValue,
} from "../../../common/components/CommonField";
import { EntityFetchTable } from "../../../common/components/EntityFetchTable";
import { PropertyCollapseCard } from "../../../common/components/PropertyCollapseCard";
import { DeletePermissionButton } from "../PermissionActionButton";

import { UserRoleCreateDialog } from "./AssignUserToRoleDialog";

export const UserRolesCard = (props: { user_id: string }) => {
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
        field: "v1",
        headerName: "Role Name",
        flex: 1,
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
        field: "created_at",
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
      {
        field: "creator",
        headerName: "Created By",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <GetEntityLink {...params.row.creator} />
        ),
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
    <PropertyCollapseCard
      title={"User Roles"}
      expanded={true}
      id="user-roles-card"
    >
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
          user_id={user_id}
          open={isDialogOpen}
          onClose={handleCloseDialog}
        />
      </PermissionWrapper>

      <EntityFetchTable
        title="User Roles"
        entityName={`permissions/user/${user_id}/role`}
        columns={columns}
        fields={["id"]}
      />
    </PropertyCollapseCard>
  );
};
