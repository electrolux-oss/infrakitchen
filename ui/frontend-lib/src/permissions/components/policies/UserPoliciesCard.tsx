import { useCallback, useMemo, useRef, useState } from "react";

import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import {
  GetEntityLink,
  GetReferenceUrlValue,
} from "../../../common/components/CommonField";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../../common/components/EntityFetchTable";
import { OverviewCard } from "../../../common/components/OverviewCard";
import { RelativeTime } from "../../../common/components/RelativeTime";
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

  const columns = useMemo(
    () => [
      {
        field: "resourceName",
        fetchFields: ["entityData"],
        headerName: "Resource Name",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <GetEntityLink
              id={params.row.entityData?.id}
              entityName={params.row.entityData?.entityName}
              name={params.row.entityData?.name || "Unknown Entity"}
            />
          );
        },
      },
      {
        field: "action",
        fetchFields: ["v2"],
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
          Add Resource Policy
        </Button>
        <EntityPolicyUserCreateDialog
          userId={userId}
          open={isDialogOpen}
          onClose={handleCloseDialog}
          onSuccess={refreshPoliciesTable}
        />
      </PermissionWrapper>
      <EntityFetchTable
        ref={tableRef}
        title="User Policies"
        entityName="permission"
        defaultFilter={{ ptype: "p", v0: `user:${userId}` }}
        columns={columns}
        entityFieldMap={PERMISSION_FIELD_MAP}
      />
    </OverviewCard>
  );
};
