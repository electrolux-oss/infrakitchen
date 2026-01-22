import { useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import {
  GetEntityLink,
  getDateValue,
  GetReferenceUrlValue,
} from "../../../common/components/CommonField";
import { EntityFetchTable } from "../../../common/components/EntityFetchTable";
import { PropertyCollapseCard } from "../../../common/components/PropertyCollapseCard";
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
        headerName: "Resource Name",
        flex: 1,
        sortable: false,
        hideable: false,
        fetchFields: ["resource_name", "resource_id"],
        renderCell: (params: GridRenderCellParams) => {
          return (
            <GetEntityLink
              id={params.row.resource_id}
              _entity_name={"resource"}
              name={params.row.resource_name}
            />
          );
        },
      },
      {
        field: "action",
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
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
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
    <PropertyCollapseCard
      title={"User Policies"}
      expanded={true}
      id="user-policies-card"
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
        entityName={`resources/permissions/user/${user_id}/policie`}
        columns={columns}
        defaultFilter={{ policy_type: "resource" }}
      />
    </PropertyCollapseCard>
  );
};
