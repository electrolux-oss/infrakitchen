import { useCallback, useMemo, useRef, useState } from "react";

import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import { GetEntityLink } from "../../../common/components/CommonField";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../../common/components/EntityFetchTable";
import { PropertyCollapseCard } from "../../../common/components/PropertyCollapseCard";
import { RelativeTime } from "../../../common/components/RelativeTime";
import { PERMISSION_FIELD_MAP } from "../../graphql";
import { DeletePermissionButton } from "../PermissionActionButton";

import { UserRoleCreateDialog } from "./AssignUserToRoleDialog";

export const RoleUsersCard = (props: { role: string }) => {
  const { role } = props;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const tableRef = useRef<EntityFetchTableRef>(null);

  const refreshRoleUsersTable = useCallback(() => {
    void tableRef.current?.refresh();
  }, []);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const columns = useMemo(
    () => [
      {
        field: "userData",
        fetchFields: ["userData"],
        headerName: "Identifier",
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <GetEntityLink
              {...params.row.userData}
              id={params.row.userData?.id}
              entityName={"user"}
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
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          if (!creator) return null;
          return (
            <GetEntityLink
              {...creator}
              name={creator.identifier}
              entityName="user"
            />
          );
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
            <DeletePermissionButton
              permission_id={params.value}
              onDelete={refreshRoleUsersTable}
            />
          </PermissionWrapper>
        ),
      },
    ],
    [refreshRoleUsersTable],
  );

  return (
    <PropertyCollapseCard title={"Role Users"} expanded={true} id="role-users">
      <PermissionWrapper
        requiredPermission="api:permission"
        permissionAction="write"
      >
        <Button
          variant="outlined"
          onClick={() => handleOpenDialog()}
          startIcon={<Icon icon="icon-park-outline:add" />}
        >
          Add User to Role
        </Button>

        <UserRoleCreateDialog
          roleName={role}
          open={isDialogOpen}
          onClose={handleCloseDialog}
          onSuccess={refreshRoleUsersTable}
        />
      </PermissionWrapper>

      <EntityFetchTable
        ref={tableRef}
        title="Role Users"
        entityName="permission"
        defaultFilter={{ ptype: "g", v1: role, v0__like: "user:%" }}
        columns={columns}
        entityFieldMap={PERMISSION_FIELD_MAP}
      />
    </PropertyCollapseCard>
  );
};
