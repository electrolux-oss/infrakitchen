import { useCallback, useMemo, useRef, useState } from "react";

import { PermissionWrapper } from "../../../common";
import { BaseCard } from "../../../common/components/cards/BaseCard";
import { Entity } from "../../../common/components/entities/Entity";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../../common/components/entity_table/EntityFetchTable";
import {
  RELATIVE_TIME_COLUMN_WIDTH,
  userColumn,
} from "../../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../../common/components/fields/RelativeTime";
import { HeroUserGroupIcon } from "../../../icons";
import { Button } from "../../../ui";
import { RenderCellParams } from "../../../ui";
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
        renderCell: (params: RenderCellParams) => {
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
        renderCell: (params: RenderCellParams) => (
          <RelativeTime
            className="flex justify-end"
            date={params.value}
            compact
          />
        ),
      },
      userColumn({ disableFilter: true }),
      {
        field: "id",
        headerName: "Delete",
        sortable: false,
        renderCell: (params: RenderCellParams) => (
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
        <div className="col-span-full mb-1 flex justify-end">
          <Button
            size="small"
            onClick={() => handleOpenDialog()}
            startIcon={<HeroUserGroupIcon />}
          >
            Assign Role
          </Button>
        </div>
      </PermissionWrapper>

      <UserRoleCreateDialog
        userId={userId}
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onSuccess={refreshUserRolesTable}
      />

      <div className="col-span-full">
        <EntityFetchTable
          ref={tableRef}
          title="User Roles"
          entityName="permission"
          columns={columns}
          defaultFilter={{ ptype: "g", v0: `user:${userId}` }}
          entityFieldMap={PERMISSION_FIELD_MAP}
        />
      </div>
    </BaseCard>
  );
};
