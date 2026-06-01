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
import { PERMISSION_FIELD_MAP, transformPermission } from "../../graphql";
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
        fetchFields: ["entity_data"],
        headerName: "Resource Name",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <GetEntityLink
              id={params.row.entity_data?.id}
              _entity_name={params.row.entity_data?._entity_name}
              name={params.row.entity_data?.name || "Unknown Entity"}
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
          user_id={user_id}
          open={isDialogOpen}
          onClose={handleCloseDialog}
        />
      </PermissionWrapper>
      <EntityFetchTable
        title="User Policies"
        entityName="permission"
        defaultFilter={{ ptype: "p", v0: `user:${user_id}` }}
        columns={columns}
        entityFieldMap={PERMISSION_FIELD_MAP}
        transformFn={transformPermission}
      />
    </OverviewCard>
  );
};
