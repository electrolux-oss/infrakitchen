import { useCallback, useMemo, useRef, useState } from "react";

import { Entity, PermissionWrapper } from "../../../common";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../../common/components/entity_table/EntityFetchTable";
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

import { RolePolicyEntityCreateDialog } from "./EntityPoliciesDialogs";

export const EntityRolePoliciesCard = (props: { role: string }) => {
  const { role } = props;

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

  const columns = useMemo(
    () => [
      {
        field: "entityData",
        fetchFields: ["entityData", "v1", "entityName"],
        headerName: "Resource",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: RenderCellParams) => {
          if (params.row.v1 && params.row.v1.includes("*")) {
            return <span>{params.row.v1}</span>;
          }
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
        renderCell: (params: RenderCellParams) => (
          <RelativeTime
            className="flex justify-end"
            date={params.value}
            compact
          />
        ),
      },
      userColumn({ disableFilter: true, sortField: null }),
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
    <>
      <PermissionWrapper
        requiredPermission="api:permission"
        permissionAction="write"
      >
        <div className="mb-1 flex w-full justify-end">
          <Button
            size="small"
            onClick={() => handleOpenDialog()}
            startIcon={<HeroPlusCircleIcon />}
          >
            Add Resource Policy
          </Button>
        </div>
      </PermissionWrapper>
      <RolePolicyEntityCreateDialog
        roleName={role}
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onSuccess={refreshPoliciesTable}
      />
      <EntityFetchTable
        ref={tableRef}
        title="Role Policies"
        entityName="permission"
        defaultFilter={{ v0: role, ptype: "p", v1__not_like: "api:%" }}
        columns={columns}
        entityFieldMap={PERMISSION_FIELD_MAP}
      />
    </>
  );
};
