import { useCallback, useMemo, useRef, useState } from "react";

import { Entity, PermissionWrapper } from "../../../common";
import { BaseCard } from "../../../common/components/cards/BaseCard";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../../common/components/entity_table/EntityFetchTable";
import type { EntityTableColumn } from "../../../common/components/entity_table/EntityTable";
import {
  RELATIVE_TIME_COLUMN_WIDTH,
  userColumn,
} from "../../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../../common/components/fields/RelativeTime";
import { HeroPlusCircleIcon } from "../../../icons";
import { Button } from "../../../ui";
import { RenderCellParams } from "../../../ui";
import { PERMISSION_FIELD_MAP } from "../../graphql";
import { DeletePermissionButton } from "../PermissionActionButton";

import { EntityPolicyUserCreateDialog } from "./EntityPoliciesDialogs";

export const UserPoliciesCard = (props: { userId: string }) => {
  const { userId } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const tableRef = useRef<EntityFetchTableRef>(null);

  const refreshPoliciesTable = useCallback(() => {
    void tableRef.current?.refresh();
  }, []);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const columns = useMemo<EntityTableColumn[]>(
    () => [
      {
        field: "resourceName",
        fetchFields: ["entityData"],
        headerName: "Resource Name",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: RenderCellParams) => {
          return (
            <Entity
              entity={params.row.entityData}
              showLifecycleState={false}
              showLabel
            />
          );
        },
      },
      {
        field: "action",
        fetchFields: ["v2"],
        headerName: "Action",
        flex: 1,
        renderCell: (params: RenderCellParams) => {
          if (params.row.action) {
            return params.row.action;
          } else {
            return params.row.v2;
          }
        },
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        align: "right",
        headerAlign: "right",
        renderCell: (params: RenderCellParams) => (
          <RelativeTime
            className="flex justify-end"
            date={params.value}
            compact
          />
        ),
      },
      userColumn({ disableFilter: true, sortable: false, sortField: null }),
      {
        field: "id",
        headerName: "Delete",
        sortable: false,
        flex: 1,
        renderCell: (params: RenderCellParams) => (
          <PermissionWrapper
            requiredPermission="api:permission"
            permissionAction="admin"
          >
            <DeletePermissionButton
              permission_id={params.value}
              onDelete={refreshPoliciesTable}
            />
          </PermissionWrapper>
        ),
      },
    ],
    [refreshPoliciesTable],
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
            startIcon={<HeroPlusCircleIcon />}
          >
            Add Resource Policy
          </Button>
        </div>
      </PermissionWrapper>
      <EntityPolicyUserCreateDialog
        userId={userId}
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onSuccess={refreshPoliciesTable}
      />
      <div className="col-span-full">
        <EntityFetchTable
          ref={tableRef}
          title="User Policies"
          entityName="permission"
          defaultFilter={{ ptype: "p", v0: `user:${userId}` }}
          columns={columns}
          entityFieldMap={PERMISSION_FIELD_MAP}
        />
      </div>
    </BaseCard>
  );
};
