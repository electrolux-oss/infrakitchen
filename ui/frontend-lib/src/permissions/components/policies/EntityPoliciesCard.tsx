import { useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import {
  GetEntityLink,
  getDateValue,
  GetReferenceUrlValue,
  capitalizeFirstLetter,
} from "../../../common/components/CommonField";
import { EntityFetchTable } from "../../../common/components/EntityFetchTable";
import { PropertyCollapseCard } from "../../../common/components/PropertyCollapseCard";
import { DeletePermissionButton } from "../PermissionActionButton";

import {
  EntityPolicyRoleCreateDialog,
  UserPolicyEntityCreateDialog,
} from "./EntityPoliciesDialogs";

export const EntityPoliciesCard = (props: {
  entity_id: string;
  entity_name: string;
}) => {
  const { entity_id, entity_name = "resource" } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleOpenUserDialog = () => {
    setIsUserDialogOpen(true);
  };

  const handleCloseUserDialog = () => {
    setIsUserDialogOpen(false);
  };

  const columns = useMemo(
    () => [
      {
        field: "v1",
        headerName: "Role/User Name",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          if (params.row.v0.startsWith("user:")) {
            return (
              <GetEntityLink
                id={params.row.v0.split(":")[1]}
                _entity_name={"user"}
                name={params.row.v0.split(":")[1]}
              />
            );
          } else {
            return (
              <GetEntityLink
                id={params.row.v0}
                _entity_name={"role"}
                name={params.row.v0}
              />
            );
          }
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
      title={`${capitalizeFirstLetter(entity_name)} Policy List`}
      expanded={true}
      id="role-policies"
    >
      <PermissionWrapper
        requiredPermission={"api:permission"}
        permissionAction="write"
      >
        <Button
          variant="outlined"
          onClick={() => handleOpenDialog()}
          startIcon={<Icon icon="icon-park-outline:add" />}
        >
          Add Role
        </Button>
        <EntityPolicyRoleCreateDialog
          entity_id={entity_id}
          entity_name={entity_name}
          open={isDialogOpen}
          onClose={handleCloseDialog}
        />
        <Button
          variant="outlined"
          onClick={() => handleOpenUserDialog()}
          startIcon={<Icon icon="icon-park-outline:add" />}
        >
          Add User
        </Button>
        <UserPolicyEntityCreateDialog
          entity_id={entity_id}
          entity_name={entity_name}
          open={isUserDialogOpen}
          onClose={handleCloseUserDialog}
        />
      </PermissionWrapper>
      <EntityFetchTable
        title={`${capitalizeFirstLetter(entity_name)} Policies`}
        entityName={`permissions/${entity_name}/${entity_id}/policie`}
        columns={columns}
      />
    </PropertyCollapseCard>
  );
};
