import { useCallback, useMemo, useRef, useState } from "react";

import { PermissionWrapper } from "../../../common";
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
import { HeroPlusCircleIcon } from "../../../icons";
import { Button } from "../../../ui";
import { RenderCellParams } from "../../../ui";
import { PERMISSION_FIELD_MAP } from "../../graphql";
import { DeletePermissionButton } from "../PermissionActionButton";

import { PolicyApiCreateDialog } from "./PolicyApiCreateDialog";

export const ApiPoliciesCard = (props: { role: string }) => {
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
        fetchFields: ["entityData", "v1"],
        headerName: "Entity Name",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: RenderCellParams) => {
          if (!params.row.entityData) {
            // API type policy
            return params.row.v1;
          }
          return (
            <Entity entity={params.row.entityData} showLifecycleState={false} />
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
            Add Api Policy
          </Button>
        </div>
      </PermissionWrapper>
      <PolicyApiCreateDialog
        role_name={role}
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onSuccess={refreshPoliciesTable}
      />
      <EntityFetchTable
        ref={tableRef}
        title="Api Policies"
        entityName="permission"
        defaultFilter={{ v0: role, ptype: "p", v1__like: "api:%" }}
        columns={columns}
        entityFieldMap={PERMISSION_FIELD_MAP}
      />
    </>
  );
};
