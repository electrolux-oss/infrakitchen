import { useCallback, useMemo, useRef, useState } from "react";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { Box, Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import { BaseCard } from "../../../common/components/cards/BaseCard";
import { Entity } from "../../../common/components/entities/Entity";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../../common/components/entity_table/EntityFetchTable";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../../common/components/fields/RelativeTime";
import { PERMISSION_FIELD_MAP } from "../../graphql";
import { DeletePermissionButton } from "../PermissionActionButton";

import { UserRoleCreateDialog } from "./AssignUserToRoleDialog";

export const UserRolesCard = (props: { userId: string }) => {
  const { userId } = props;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const tableRef = useRef<EntityFetchTableRef>(null);

  const refreshUserRolesTable = useCallback(() => {
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
        field: "v1",
        headerName: "Role Name",
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <Entity
              entity={{
                id: params.row.v1,
                entityType: "role",
                name: params.row.v1,
              }}
            />
          );
        },
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime date={params.value} sx={{ display: "flex" }} />
        ),
      },
      {
        field: "creator",
        headerName: "Creator",
        flex: 1,
        sortField: "creator.identifier",
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) => (
          <Entity entity={{ ...params.row.creator, entityType: "user" }} />
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
            <DeletePermissionButton
              permission_id={params.value}
              onDelete={refreshUserRolesTable}
            />
          </PermissionWrapper>
        ),
      },
    ],
    [refreshUserRolesTable],
  );

  return (
    <BaseCard>
      <PermissionWrapper
        requiredPermission="api:permission"
        permissionAction="write"
      >
        <Box
          sx={{
            display: "flex",
            width: "100%",
            justifyContent: "flex-end",
            mb: 0.5,
          }}
        >
          <Button
            size="small"
            onClick={() => handleOpenDialog()}
            startIcon={<AdminPanelSettingsIcon />}
          >
            Assign Role
          </Button>
        </Box>
      </PermissionWrapper>

      <UserRoleCreateDialog
        userId={userId}
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onSuccess={refreshUserRolesTable}
      />

      <EntityFetchTable
        ref={tableRef}
        title="User Roles"
        entityName="permission"
        columns={columns}
        defaultFilter={{ ptype: "g", v0: `user:${userId}` }}
        entityFieldMap={PERMISSION_FIELD_MAP}
      />
    </BaseCard>
  );
};
